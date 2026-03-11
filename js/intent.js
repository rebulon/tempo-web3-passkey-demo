// ═══════════════════════════════════════════════════
//  js/intent.js
//  ШАГ 5 — TIP-1023 IntentPayload. Сборка и хэш.
//  Кидай в папку: tip1023/js/intent.js
//  Зависит от: config.js
// ═══════════════════════════════════════════════════

// ── Построить payload ─────────────────────────────────
function buildIntentPayload({
  conditions      = [],
  effects         = [],
  validAfter      = 0,
  validBefore     = 0,
  feeToken,
  feeCeilingStr   = '0.05',    // строка типа "0.05"
  surplusShare    = 70,
  sender,
  nonce,
}) {
  // Парсим feeCeiling в микроединицы (6 decimals)
  const parts      = feeCeilingStr.split('.')
  const whole      = BigInt(parts[0] || '0')
  const fracStr    = (parts[1] || '').padEnd(6, '0').slice(0, 6)
  const frac       = BigInt(fracStr)
  const feeCeiling = whole * 1_000_000n + frac

  return {
    chainId:      BigInt(CFG.CHAIN_ID),
    version:      CFG.INTENT_VERSION,
    conditions:   conditions.slice(0, CFG.MAX_CONDITIONS),
    effects:      effects.slice(0, CFG.MAX_EFFECTS),
    validAfter:   BigInt(validAfter),
    validBefore:  BigInt(validBefore),
    feeToken:     feeToken || '0x0000000000000000000000000000000000000000',
    feeCeiling,
    surplusShare: Math.max(0, Math.min(100, surplusShare)),
    sender:       sender || '0x0000000000000000000000000000000000000000',
    nonce:        BigInt(nonce || Date.now()),
  }
}

// ── Хэш интента для подписи ───────────────────────────
// intentHash = SHA-256( 0x49 || chainId || sender || nonce || feeCeiling || surplusShare || feeToken )
// Используем SubtleCrypto SHA-256 (браузерный, без библиотек)
// В реальном протоколе будет keccak256, здесь это превью-хэш

async function hashIntent(payload) {
  // Кодируем поля как байты
  const encoder = new TextEncoder()
  const fields  = [
    'TIP1023',
    payload.chainId.toString(),
    payload.sender,
    payload.nonce.toString(),
    payload.feeCeiling.toString(),
    payload.surplusShare.toString(),
    payload.feeToken,
    payload.version.toString(),
  ]
  const str    = fields.join(':')
  const data   = new Uint8Array([
    CFG.INTENT_TX_TYPE,         // 0x49 префикс
    ...encoder.encode(str),
  ])

  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return '0x' + Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Описание интента (для превью) ────────────────────
function describeIntent(payload, scenarioLabel) {
  const ceiling = (Number(payload.feeCeiling) / 1_000_000).toFixed(2)
  const lines   = []
  lines.push(`// TIP-1023 IntentPayload`)
  lines.push(`tx_type:       0x${CFG.INTENT_TX_TYPE.toString(16)}`)
  lines.push(`chain_id:      ${payload.chainId}`)
  lines.push(`version:       ${payload.version}`)
  lines.push(`scenario:      ${scenarioLabel}`)
  lines.push(`sender:        ${payload.sender}`)
  lines.push(`fee_token:     ${payload.feeToken}`)
  lines.push(`fee_ceiling:   $${ceiling}`)
  lines.push(`surplus_share: ${payload.surplusShare}% → пользователю`)
  lines.push(`nonce:         ${payload.nonce}`)
  if (payload.conditions.length) {
    lines.push(`conditions:    ${payload.conditions.map(c => c.type).join(', ')}`)
  }
  return lines.join('\n')
}