// ═══════════════════════════════════════════════════
//  js/config.js
//  ШАГ 1 — Константы. Реальные адреса Tempo Testnet.
//  Кидай в папку: tip1023/js/config.js
// ═══════════════════════════════════════════════════

// ── Сеть ─────────────────────────────────────────────
const CFG = {
  RPC:      'https://rpc.moderato.tempo.xyz',
  CHAIN_ID: 42431,
  CHAIN_HEX:'0xa5ff',
  EXPLORER: 'https://explore.tempo.xyz',
  SPONSOR:  'https://sponsor.moderato.tempo.xyz',

  // ── Реальные адреса TIP-20 токенов ─────────────────
  // Источник: docs.tempo.xyz/quickstart/faucet
  TOKENS: {
    pathUSD: {
      address:  '0x20c0000000000000000000000000000000000000',
      symbol:   'pathUSD',
      decimals: 6,
      color:    '#ff4d00',
    },
    AlphaUSD: {
      address:  '0x20c0000000000000000000000000000000000001',
      symbol:   'AlphaUSD',
      decimals: 6,
      color:    '#1a6bff',
    },
    BetaUSD: {
      address:  '0x20c0000000000000000000000000000000000002',
      symbol:   'BetaUSD',
      decimals: 6,
      color:    '#00a878',
    },
    ThetaUSD: {
      address:  '0x20c0000000000000000000000000000000000003',
      symbol:   'ThetaUSD',
      decimals: 6,
      color:    '#9c27b0',
    },
  },

  // ── TIP-1023 спецификация ───────────────────────────
  INTENT_TX_TYPE: 0x49,   // тип транзакции
  INTENT_VERSION: 1,
  MAX_EFFECTS:    32,
  MAX_CONDITIONS: 16,
  TTL_MAX:        3600,   // секунд

  // ── MetaMask параметры сети ─────────────────────────
  MM_CHAIN: {
    chainId:           '0xa5ff',
    chainName:         'Tempo Testnet (Moderato)',
    nativeCurrency:    { name: 'USD', symbol: 'USD', decimals: 18 },
    rpcUrls:           ['https://rpc.moderato.tempo.xyz'],
    blockExplorerUrls: ['https://explore.tempo.xyz'],
  },

  // ── Сценарии ────────────────────────────────────────
  SCENARIOS: [
    {
      id:        'fx_swap',
      label:     'FX Swap (pathUSD → AlphaUSD)',
      fromToken: 'pathUSD',
      toToken:   'AlphaUSD',
      amount:    '100',
      conditions:[{ type: 'PRICE_GTE', param: '0.99' }],
    },
    {
      id:        'transfer',
      label:     'Transfer (pathUSD)',
      fromToken: 'pathUSD',
      toToken:   null,
      amount:    '50',
      conditions:[],
    },
    {
      id:        'payroll',
      label:     'Payroll Batch (BetaUSD)',
      fromToken: 'BetaUSD',
      toToken:   null,
      amount:    '1000',
      conditions:[{ type: 'BLOCK_GTE', param: '' }],
    },
    {
      id:        'scheduled',
      label:     'Scheduled (ThetaUSD)',
      fromToken: 'ThetaUSD',
      toToken:   null,
      amount:    '200',
      conditions:[{ type: 'TIMESTAMP_GTE', param: '' }],
    },
  ],
}