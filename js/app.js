// ═══════════════════════════════════════════════════
//  js/app.js
//  ШАГ 6 — Логика UI. Все события и состояние экрана.
//  Кидай в папку: tip1023/js/app.js
//  Зависит от: config.js, passkey.js, wallet.js, tokens.js, intent.js
// ═══════════════════════════════════════════════════

// ── Shorthand для getElementById ─────────────────────
const $ = id => document.getElementById(id)

// ── UI: показать/скрыть секцию ────────────────────────
function show(id)  { const e = $(id); if (e) e.style.display = '' }
function hide(id)  { const e = $(id); if (e) e.style.display = 'none' }
function text(id, t) { const e = $(id); if (e) e.textContent = t }
function html(id, h) { const e = $(id); if (e) e.innerHTML = h }

// ── Алерты ───────────────────────────────────────────
function showError(id, msg) {
  const el = $(id)
  if (!el) return
  el.textContent = msg
  el.className   = 'alert alert-err'
  el.style.display = msg ? '' : 'none'
}
function showSuccess(id, msg) {
  const el = $(id)
  if (!el) return
  el.textContent = msg
  el.className   = 'alert alert-ok'
  el.style.display = msg ? '' : 'none'
}

// ── ИНИЦИАЛИЗАЦИЯ страницы ───────────────────────────
function initPage() {
  // Секция connect: проверяем есть ли сохранённый passkey
  const stored = getStoredPasskey()
  if (stored) {
    show('pk-stored-block')
    hide('pk-new-block')
    html('pk-stored-info',
      `Found: <strong>${stored.username}</strong><br>
       <span style="color:#1a6bff;font-size:11px">${stored.address}</span>`)
  } else {
    hide('pk-stored-block')
    show('pk-new-block')
  }

  // Заполняем dropdown сценариев
  const sel = $('sel-scenario')
  if (sel) {
    sel.innerHTML = CFG.SCENARIOS.map(s =>
      `<option value="${s.id}">${s.label}</option>`
    ).join('')
  }

  // Заполняем fee token dropdown
  const selFee = $('sel-fee-token')
  if (selFee) {
    selFee.innerHTML = Object.entries(CFG.TOKENS).map(([sym]) =>
      `<option value="${sym}">${sym} (Circle)</option>`
    ).join('')
  }

  // Начальный сценарий
  updateScenario()

  // Слушатели изменений формы для live hash
  $('sel-scenario')?.addEventListener('change', () => {
    updateScenario()
    refreshLiveHash()
  })
  $('sel-fee-token')?.addEventListener('change', refreshLiveHash)
  $('inp-fee-ceiling')?.addEventListener('input', refreshLiveHash)
  $('inp-amount')?.addEventListener('input', refreshLiveHash)

  // Слайдер surplus share
  const slider = $('inp-surplus')
  if (slider) {
    slider.addEventListener('input', () => {
      text('surplus-val', slider.value + '%')
      refreshLiveHash()
    })
  }

  // Кнопка generate
  $('btn-generate')?.setAttribute('disabled', 'true')
}

// ── Обновить UI сценария ─────────────────────────────
function updateScenario() {
  const sc = CFG.SCENARIOS.find(s => s.id === $('sel-scenario')?.value)
  if (!sc) return

  // Токен FROM
  const fromMeta = CFG.TOKENS[sc.fromToken]
  if (fromMeta) {
    const dot = $('tok-from-dot')
    if (dot) dot.style.background = fromMeta.color
    text('tok-from-sym', sc.fromToken)
    text('tok-from-addr', fromMeta.address.slice(0, 10) + '…' + fromMeta.address.slice(-4))
    // Баланс если есть
    const bal = BALANCES[sc.fromToken]
    text('tok-from-bal', bal ? bal.formatted : '—')
  }

  // Токен TO (если есть)
  if (sc.toToken) {
    const toMeta = CFG.TOKENS[sc.toToken]
    show('tok-to-section')
    const dot = $('tok-to-dot')
    if (dot) dot.style.background = toMeta.color
    text('tok-to-sym', sc.toToken)
  } else {
    hide('tok-to-section')
  }

  // Сумма по умолчанию
  const inp = $('inp-amount')
  if (inp && !inp._userEdited) inp.value = sc.amount
  text('amount-label', `AMOUNT (${sc.fromToken})`)

  // Conditions
  if (sc.conditions.length) {
    show('cond-section')
    html('cond-list', sc.conditions.map(c =>
      `<div class="cond-row">
         <span class="cond-type">${c.type}</span>
         ${c.param ? `<span class="cond-param">${c.param}</span>` : ''}
       </div>`
    ).join(''))
  } else {
    hide('cond-section')
  }
}

// ── Live hash preview ────────────────────────────────
async function refreshLiveHash() {
  if (!WALLET.address) {
    text('live-hash', '— connect wallet to preview —')
    return
  }

  const sc       = CFG.SCENARIOS.find(s => s.id === $('sel-scenario')?.value)
  const feeToken = CFG.TOKENS[$('sel-fee-token')?.value]
  const surplus  = parseInt($('inp-surplus')?.value || '70')
  const ceiling  = $('inp-fee-ceiling')?.value || '0.05'

  const payload = buildIntentPayload({
    feeToken:    feeToken?.address,
    feeCeilingStr: ceiling,
    surplusShare: surplus,
    sender:      WALLET.address,
    conditions:  sc?.conditions || [],
  })

  const hash = await hashIntent(payload)
  const el   = $('live-hash')
  if (el) {
    el.textContent = hash
    el.style.color = '#1a1a1a'
  }
}

// ── После подключения кошелька ───────────────────────
async function onWalletConnected() {
  // Топбар
  hide('topbar-disconnected')
  show('topbar-connected')
  text('tb-addr', shortAddr(WALLET.address))
  const tbLink = $('tb-addr-link')
  if (tbLink) tbLink.href = `${CFG.EXPLORER}/address/${WALLET.address}`
  text('tb-wallet-icon', WALLET.type === 'passkey' ? '🔑' : '🦊')

  // Connect panel → показываем connected state
  hide('section-not-connected')
  show('section-connected')
  text('conn-type-label', WALLET.type === 'passkey' ? '🔑 Passkey connected' : '🦊 MetaMask connected')
  text('conn-addr-full', WALLET.address)

  // Key details (только passkey)
  if (WALLET.passkeyData) {
    const pd = WALLET.passkeyData
    html('key-details-code',
      `<div><span class="ck">username  </span><span class="cv">${pd.username}</span></div>
       <div><span class="ck">algo      </span><span class="cv">${pd.algo}</span></div>
       <div><span class="ck">address   </span><span class="cg">${pd.address}</span></div>
       <div><span class="ck">cred_id   </span><span class="cb">${pd.credentialId.slice(0, 28)}…</span></div>
       <div><span class="ck">sig_type  </span><span class="cv">0x02 WebAuthn/P-256</span></div>
       <div><span class="ck">created   </span><span class="cdim">${new Date(pd.createdAt).toLocaleString()}</span></div>`)
  }

  // Подпись в форме
  text('sig-type-display', WALLET.type === 'passkey' ? 'P-256 (WebAuthn) 🔑' : 'secp256k1 🦊')

  // Поле адреса получателя только для MetaMask
  if (WALLET.type === 'metamask') show('field-to-address')
  else hide('field-to-address')

  // Фаусет
  show('panel-faucet')

  // Включаем кнопку
  $('btn-generate')?.removeAttribute('disabled')
  hide('hint-connect')

  // Загружаем балансы
  await refreshBalances()
  updateScenario()
  refreshLiveHash()

  // Автообновление каждые 8 секунд
  setInterval(async () => {
    if (WALLET.address) {
      await refreshBalances()
      updateScenario()
    }
  }, 8000)

  // Обновление номера блока
  updateBlockNumber()
  setInterval(updateBlockNumber, 5000)
}

async function refreshBalances() {
  if (!WALLET.address) return
  await fetchAllBalances(WALLET.address)

  // Обновляем фаусет строки
  Object.entries(BALANCES).forEach(([sym, b]) => {
    const el = $(`fbal-${sym.toLowerCase()}`)
    if (el) {
      el.textContent = b.formatted
      el.style.color = b.raw > 0n ? '#00a878' : '#888'
    }
  })

  // Обновляем топбар пилюли
  Object.entries(BALANCES).forEach(([sym, b]) => {
    const el = $(`tb-bal-${sym.toLowerCase()}`)
    if (el) {
      el.textContent = b.formatted
      show(`tb-tok-${sym.toLowerCase()}`)
    }
  })
}

async function updateBlockNumber() {
  const block = await getCurrentBlock()
  if (block) text('tb-block', 'block ' + block.toLocaleString())
}

// ── КНОПКИ ПОДКЛЮЧЕНИЯ ───────────────────────────────

async function clickRegisterPasskey() {
  const btn      = $('btn-register-pk')
  const username = $('inp-pk-username')?.value || 'tempo-user'
  showError('connect-err', '')
  if (btn) btn.disabled = true
  if (btn) btn.textContent = '⏳ Creating key...'

  try {
    await connectViaNewPasskey(username)
    await onWalletConnected()
  } catch (e) {
    showError('connect-err', e.message)
  } finally {
    if (btn) btn.disabled = false
    if (btn) btn.textContent = '🔑 Create Passkey'
  }
}

async function clickLoginPasskey() {
  const btn = $('btn-login-pk')
  showError('connect-err', '')
  if (btn) btn.disabled = true
  if (btn) btn.textContent = '⏳ Signing in...'

  try {
    await connectViaExistingPasskey()
    await onWalletConnected()
  } catch (e) {
    showError('connect-err', e.message)
  } finally {
    if (btn) btn.disabled = false
    if (btn) btn.textContent = '🔑 Sign In with Passkey'
  }
}

function clickDeletePasskey() {
  clearStoredPasskey()
  location.reload()
}

async function clickConnectMetaMask() {
  const btn = $('btn-metamask')
  showError('connect-err', '')
  if (btn) btn.disabled = true
  if (btn) btn.textContent = '⏳ Connecting...'

  try {
    await connectMetaMask()
    await onWalletConnected()
  } catch (e) {
    showError('connect-err', e.message)
  } finally {
    if (btn) btn.disabled = false
    if (btn) btn.textContent = '🦊 MetaMask'
  }
}

function clickDisconnect() {
  disconnectWallet()
  location.reload()
}

function clickToggleKeyDetails() {
  const d = $('key-details-section')
  const b = $('btn-key-toggle')
  const show_ = d.style.display === 'none'
  d.style.display = show_ ? '' : 'none'
  b.textContent   = show_ ? '▲ hide key' : '▼ key details'
}

// ── ФАУСЕТ ───────────────────────────────────────────
async function clickFaucet() {
  if (!WALLET.address) return
  const btn = $('btn-faucet')
  hide('faucet-msg')
  if (btn) btn.disabled = true
  if (btn) btn.textContent = '⏳ Requesting...'

  try {
    await requestFaucet(WALLET.address)
    showSuccess('faucet-msg', '✓ Tokens received! Refreshing balances...')
    setTimeout(refreshBalances, 3000)
  } catch (e) {
    showError('faucet-msg', '✕ ' + e.message)
  } finally {
    if (btn) btn.disabled = false
    if (btn) btn.textContent = '💧 Get Tokens (1M each)'
  }
}

// ── GENERATE INTENT ──────────────────────────────────
async function clickGenerate() {
  if (!WALLET.address) return

  const btn = $('btn-generate')
  if (btn) btn.disabled = true

  show('panel-status')
  setStatus('orange', 'Generating intent...')
  clearStatusDetails()

  try {
    const sc      = CFG.SCENARIOS.find(s => s.id === $('sel-scenario')?.value)
    const feeSymbol = $('sel-fee-token')?.value || 'pathUSD'
    const feeMeta = CFG.TOKENS[feeSymbol]
    const surplus = parseInt($('inp-surplus')?.value || '70')
    const ceiling = $('inp-fee-ceiling')?.value || '0.05'

    // Строим payload
    const payload = buildIntentPayload({
      conditions:   sc?.conditions || [],
      effects:      [{
        token:     feeMeta.address,
        symbol:    sc?.fromToken,
        direction: 0,
        amount:    $('inp-amount')?.value || sc?.amount,
      }],
      feeToken:     feeMeta.address,
      feeCeilingStr: ceiling,
      surplusShare: surplus,
      sender:       WALLET.address,
    })

    // Хэш
    const intentHash = await hashIntent(payload)
    show('status-intent-hash')
    text('s-intent-hash', intentHash)

    // ── Passkey путь ──────────────────────────────────
    if (WALLET.type === 'passkey') {
      setStatus('orange', '🔑 Sign with passkey...')
      if (btn) btn.textContent = '⏳ Awaiting signature...'

      const sig = await signWithPasskey(intentHash)

      setStatus('green', '✓ Intent signed!')
      show('status-sig-block')
      html('status-sig-code',
        `<div><span class="ck">sig_type     </span><span class="cv">0x02 WebAuthn/P-256</span></div>
         <div><span class="ck">credential_id</span><span class="cb">${sig.credentialId.slice(0, 28)}…</span></div>
         <div><span class="ck">address      </span><span class="cg">${sig.address}</span></div>
         <div><span class="ck">auth_data    </span><span class="cb">${sig.authenticatorData.slice(0, 26)}…</span></div>
         <div><span class="ck">client_data  </span><span class="cb">${sig.clientDataJSON.slice(0, 26)}…</span></div>
         <div><span class="ck">signature    </span><span class="cv">${sig.signatureHex.slice(0, 32)}…</span></div>
         <div><span class="ck">surplus_share</span><span class="cv">${surplus}% → to user</span></div>`)

      showSuccess('status-ok-msg',
        `Intent hashed and signed P-256. Surplus share ${surplus}% · fee_ceiling $${ceiling}`)
      return
    }

    // ── MetaMask путь ─────────────────────────────────
    if (WALLET.type === 'metamask') {
      const toAddr = $('inp-to-address')?.value?.trim()
      if (!toAddr || !/^0x[0-9a-fA-F]{40}$/.test(toAddr)) {
        throw new Error('Enter a valid recipient address (0x...)')
      }

      setStatus('blue', '📡 Sending TIP-20 transfer...')
      if (btn) btn.textContent = '⏳ Confirm in MetaMask...'

      const amount = $('inp-amount')?.value || sc?.amount || '1'
      const txHash = await sendTransfer(WALLET.address, sc?.fromToken, toAddr, amount)

      show('status-tx-hash')
      const txEl = $('s-tx-hash')
      if (txEl) {
        txEl.textContent = txHash.slice(0, 18) + '…' + txHash.slice(-6)
        txEl.href = `${CFG.EXPLORER}/tx/${txHash}`
      }

      setStatus('orange', '⏳ Waiting for block...')
      if (btn) btn.textContent = '⏳ Waiting...'

      const result = await waitForReceipt(txHash)
      if (result.success) {
        setStatus('green', '✓ Transaction confirmed!')
        showSuccess('status-ok-msg',
          `TIP-20 transfer complete. Intent hash: ${intentHash.slice(0, 18)}…`)
        refreshBalances()
      } else {
        throw new Error('Transaction rejected by network (status 0x0)')
      }
    }

  } catch (e) {
    setStatus('red', '✕ Error')
    showError('status-err-msg', e.message || 'Unknown error')
  } finally {
    if (btn) btn.disabled = false
    if (btn) btn.textContent = 'GENERATE INTENT →'
  }
}

function clickResetStatus() {
  hide('panel-status')
  clearStatusDetails()
}

// ── Состояние статус панели ──────────────────────────
function setStatus(color, label) {
  const dot = $('status-dot')
  if (dot) {
    dot.className = 'status-dot'
    if (color === 'green')  dot.classList.add('s-green')
    if (color === 'orange') dot.classList.add('s-orange')
    if (color === 'red')    dot.classList.add('s-red')
    if (color === 'blue')   dot.classList.add('s-blue')
  }
  text('status-label', label)
}

function clearStatusDetails() {
  hide('status-intent-hash')
  hide('status-tx-hash')
  hide('status-sig-block')
  hide('status-ok-msg')
  hide('status-err-msg')
  text('status-err-msg', '')
}

// ── Старт ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initPage)