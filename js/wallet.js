// ═══════════════════════════════════════════════════
//  js/wallet.js — wallet connection
// ═══════════════════════════════════════════════════

const WALLET = {
  address:     null,
  type:        null,
  chainId:     null,
  passkeyData: null,
}

async function rpcCall(method, params = []) {
  const resp = await fetch(CFG.RPC, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
  })
  const data = await resp.json()
  if (data.error) throw new Error(data.error.message)
  return data.result
}

async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Download at metamask.io')
  }

  // Step 1: get accounts
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) throw new Error('No accounts in MetaMask')

  // Step 2: add network (MetaMask switches if already added)
  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId:           '0xa5ff',
        chainName:         'Tempo Testnet (Moderato)',
        nativeCurrency:    { name: 'USD', symbol: 'USD', decimals: 18 },
        rpcUrls:           ['https://rpc.moderato.tempo.xyz'],
        blockExplorerUrls: ['https://explore.tempo.xyz'],
      }],
    })
  } catch (e) {
    if (e.code === 4001) throw new Error('Rejected: please allow adding Tempo network')
    // -32602 = chain already exists in MetaMask, just switch
    if (e.code === -32602 || e.message?.includes('already')) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa5ff' }],
      })
    } else {
      // Fallback: try switch anyway
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa5ff' }],
        })
      } catch (sw) {
        if (sw.code === 4001) throw new Error('Rejected: please switch to Tempo network')
        throw new Error('Cannot switch to Tempo: ' + (sw.message || e.message))
      }
    }
  }

  // Step 3: verify chain
  const chainHex = await window.ethereum.request({ method: 'eth_chainId' })
  const chainId  = parseInt(chainHex, 16)
  if (chainId !== CFG.CHAIN_ID) {
    throw new Error(
      `Wrong network (got chain ${chainId}). ` +
      `Open MetaMask and manually switch to Tempo Testnet (chain 42431).`
    )
  }

  WALLET.address = accounts[0]
  WALLET.type    = 'metamask'
  WALLET.chainId = CFG.CHAIN_ID
  return WALLET
}

async function connectViaNewPasskey(username) {
  const data = await registerPasskey(username || 'tempo-user')
  WALLET.address     = data.address
  WALLET.type        = 'passkey'
  WALLET.chainId     = CFG.CHAIN_ID
  WALLET.passkeyData = data
  return WALLET
}

async function connectViaExistingPasskey() {
  const data = await authenticatePasskey()
  WALLET.address     = data.address
  WALLET.type        = 'passkey'
  WALLET.chainId     = CFG.CHAIN_ID
  WALLET.passkeyData = data
  return WALLET
}

function disconnectWallet() {
  WALLET.address = null; WALLET.type = null
  WALLET.chainId = null; WALLET.passkeyData = null
}

function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

async function getCurrentBlock() {
  try { return parseInt(await rpcCall('eth_blockNumber'), 16) }
  catch { return 0 }
}