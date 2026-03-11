// ═══════════════════════════════════════════════════
//  js/tokens.js
//  ШАГ 4 — Балансы TIP-20 и фаусет.
//  Кидай в папку: tip1023/js/tokens.js
//  Зависит от: config.js, wallet.js
// ═══════════════════════════════════════════════════

// Глобальные балансы
const BALANCES = {}

// ── Прочитать баланс одного токена ───────────────────
// eth_call → balanceOf(address)
async function fetchBalance(tokenAddress, holderAddress) {
  // balanceOf(address) = keccak256 → 0x70a08231
  const data = '0x70a08231' +
    holderAddress.slice(2).toLowerCase().padStart(64, '0')

  const result = await rpcCall('eth_call', [
    { to: tokenAddress, data },
    'latest',
  ])

  return BigInt(result || '0x0')
}

// ── Форматировать с decimals ──────────────────────────
function formatToken(rawBig, decimals = 6) {
  const divisor = BigInt(10 ** decimals)
  const whole   = rawBig / divisor
  const frac    = rawBig % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 2)
  return whole.toLocaleString('en-US') + '.' + fracStr
}

// ── Загрузить все балансы ─────────────────────────────
async function fetchAllBalances(address) {
  if (!address) return

  await Promise.all(
    Object.entries(CFG.TOKENS).map(async ([symbol, meta]) => {
      try {
        const raw = await fetchBalance(meta.address, address)
        BALANCES[symbol] = { raw, formatted: formatToken(raw, meta.decimals) }
      } catch {
        BALANCES[symbol] = { raw: 0n, formatted: '0.00' }
      }
    })
  )

  return BALANCES
}

// ── Фаусет: tempo_fundAddress ─────────────────────────
// Зачисляет 1M каждого токена на адрес
async function requestFaucet(address) {
  const resp = await fetch(CFG.RPC, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method:  'tempo_fundAddress',
      params:  [address],
      id:      Date.now(),
    }),
  })
  const data = await resp.json()
  if (data.error) throw new Error(data.error.message || 'Ошибка фаусета')
  return data.result
}

// ── Отправить TIP-20 transfer (MetaMask) ─────────────
// Это реальная транзакция на тестнете через MetaMask
async function sendTransfer(fromAddress, tokenSymbol, toAddress, amountStr) {
  const meta   = CFG.TOKENS[tokenSymbol]
  if (!meta) throw new Error('Токен не найден: ' + tokenSymbol)

  // Парсим сумму с decimals
  const parts   = amountStr.split('.')
  const whole   = BigInt(parts[0] || '0')
  const fracStr = (parts[1] || '').padEnd(meta.decimals, '0').slice(0, meta.decimals)
  const frac    = BigInt(fracStr)
  const amount  = whole * BigInt(10 ** meta.decimals) + frac

  // transfer(address,uint256) selector = 0xa9059cbb
  const paddedTo  = toAddress.slice(2).padStart(64, '0')
  const paddedAmt = amount.toString(16).padStart(64, '0')
  const data      = '0xa9059cbb' + paddedTo + paddedAmt

  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from:  fromAddress,
      to:    meta.address,
      data,
      gas:   '0x186A0',   // 100 000
    }],
  })

  return txHash
}

// ── Дождаться подтверждения транзакции ───────────────
async function waitForReceipt(txHash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const receipt = await rpcCall('eth_getTransactionReceipt', [txHash])
      if (receipt) {
        if (receipt.status === '0x1') return { success: true,  receipt }
        if (receipt.status === '0x0') return { success: false, receipt }
      }
    } catch {}
  }
  throw new Error('Транзакция не подтверждена за 60 секунд')
}