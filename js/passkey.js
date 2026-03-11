// ═══════════════════════════════════════════════════
//  js/passkey.js
//  ШАГ 2 — WebAuthn passkey. Регистрация + вход + подпись.
//  Кидай в папку: tip1023/js/passkey.js
//  Зависит от: js/config.js
// ═══════════════════════════════════════════════════

const PASSKEY_KEY = 'tip1023_pk_v1'

// ── Утилиты кодирования ──────────────────────────────

// ArrayBuffer → "0x..." hex строка
function buf2hex(buf) {
  return '0x' + Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

// ArrayBuffer → base64url строка (для хранения credentialId)
function buf2b64url(buf) {
  let bin = ''
  new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// base64url → ArrayBuffer
function b64url2buf(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// hex → ArrayBuffer (для передачи intentHash как challenge)
function hex2buf(hex) {
  const h   = hex.startsWith('0x') ? hex.slice(2) : hex
  const buf = new Uint8Array(h.length / 2)
  for (let i = 0; i < buf.length; i++)
    buf[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return buf.buffer
}

// ── Поддержка ────────────────────────────────────────

function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

// ── Регистрация нового passkey ────────────────────────
// Возвращает { credentialId, address, username, algo, createdAt }
// address = последние 20 байт SHA-256(credentialId)

async function registerPasskey(username) {
  if (!isWebAuthnSupported())
    throw new Error('WebAuthn не поддерживается этим браузером')

  const rpId      = window.location.hostname  // 'localhost' для VS Code
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId    = crypto.getRandomValues(new Uint8Array(16))

  let cred
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp:   { id: rpId, name: 'TIP-1023 Intent Builder' },
        user: { id: userId, name: username, displayName: 'Tempo · ' + username },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7   },  // ES256 = P-256 (Tempo native)
          { type: 'public-key', alg: -257 },  // RS256 fallback
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey:             'preferred',
          userVerification:        'preferred',
        },
        timeout:     60000,
        attestation: 'none',
      },
    })
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Регистрация отменена')
    throw new Error('Ошибка регистрации: ' + e.message)
  }

  // Алгоритм ключа
  let algo = 'P-256 (ES256)'
  if (cred.response.getPublicKeyAlgorithm) {
    const a = cred.response.getPublicKeyAlgorithm()
    algo = a === -7 ? 'P-256 (ES256)' : a === -257 ? 'RS256' : 'alg:' + a
  }

  // Деривируем EVM-адрес из credentialId
  const hashBuf   = await crypto.subtle.digest('SHA-256', cred.rawId)
  const hashBytes = new Uint8Array(hashBuf)
  const addrBytes = hashBytes.slice(12)          // последние 20 байт
  const address   = '0x' + Array.from(addrBytes)
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const data = {
    credentialId: buf2b64url(cred.rawId),
    address,
    username,
    algo,
    rpId,
    createdAt: Date.now(),
  }

  // Сохраняем локально
  localStorage.setItem(PASSKEY_KEY, JSON.stringify(data))
  return data
}

// ── Аутентификация существующим passkey ──────────────

async function authenticatePasskey() {
  const stored = getStoredPasskey()
  if (!stored) throw new Error('Passkey не найден. Сначала зарегистрируйтесь.')

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  let assertion
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId:             stored.rpId || window.location.hostname,
        allowCredentials: [{
          id:   b64url2buf(stored.credentialId),
          type: 'public-key',
        }],
        userVerification: 'preferred',
        timeout:          60000,
      },
    })
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Аутентификация отменена')
    throw new Error('Ошибка: ' + e.message)
  }

  if (!assertion) throw new Error('Аутентификация не удалась')
  return { ...stored, authenticated: true }
}

// ── Подпись intentHash ────────────────────────────────
// challenge = intentHash (bytes32 keccak256)
// Возвращает подпись P-256 совместимую с Tempo WebAuthn sig type

async function signWithPasskey(intentHashHex) {
  const stored = getStoredPasskey()
  if (!stored) throw new Error('Passkey не зарегистрирован')

  let assertion
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge:        hex2buf(intentHashHex),
        rpId:             stored.rpId || window.location.hostname,
        allowCredentials: [{
          id:   b64url2buf(stored.credentialId),
          type: 'public-key',
        }],
        userVerification: 'preferred',
        timeout:          60000,
      },
    })
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Подпись отменена')
    throw new Error('Ошибка подписи: ' + e.message)
  }

  const r = assertion.response
  return {
    // Идентификаторы
    credentialId:      buf2b64url(assertion.rawId),
    credentialIdHex:   buf2hex(assertion.rawId),
    // Данные подписи WebAuthn
    authenticatorData: buf2b64url(r.authenticatorData),
    clientDataJSON:    buf2b64url(r.clientDataJSON),
    signature:         buf2b64url(r.signature),
    signatureHex:      buf2hex(r.signature),
    // Метаданные
    address:           stored.address,
    algo:              stored.algo,
    intentHash:        intentHashHex,
    sigType:           '0x02',   // WebAuthn/P-256 в TIP-1023
  }
}

// ── Хранилище ─────────────────────────────────────────

function getStoredPasskey() {
  try {
    const raw = localStorage.getItem(PASSKEY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearStoredPasskey() {
  localStorage.removeItem(PASSKEY_KEY)
}