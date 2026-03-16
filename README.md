# TIP-1023 Intent Builder

A demo implementation of intent-based transactions on [Tempo Testnet](https://tempo.xyz) — sign blockchain transactions with your fingerprint instead of a seed phrase.

**Live on Tempo Testnet (Moderato) · Chain 42431**

---

## What this is

Traditional crypto UX forces users to manually approve every transaction, manage gas fees, and understand raw calldata. This demo shows a different model:

- **You declare intent** — "swap 100 pathUSD to AlphaUSD"
- **A resolver executes it** — finds the best route, pays the gas
- **You sign with Touch ID / Face ID** — no seed phrase, no MetaMask required
- **You keep the surplus** — if the resolver saves on fees, you get a share

---

## Features

- **WebAuthn passkey signing** — P-256 biometric key, works on `localhost` in Chrome / Edge / Safari
- **Real on-chain transfers** — TIP-20 token transfers confirmed on Tempo Testnet
- **Live intent hash preview** — recalculates `SHA-256(0x49 || payload)` on every field change
- **Fee mechanics** — configurable `fee_ceiling` and `surplus_share` slider (0–100% to user)
- **Auto-open explorer** — transaction link opens in [explore.tempo.xyz](https://explore.tempo.xyz) after confirmation
- **Faucet built-in** — request 1M of each testnet token via `tempo_fundAddress`
- **MetaMask fallback** — connects to Tempo chain automatically (chain 42431)

---

## Tech stack

```
Vanilla JS + HTML  — no framework, no build step
WebAuthn API       — navigator.credentials (P-256 / ES256)
Tempo RPC          — fetch() JSON-RPC calls directly
TIP-20 ABI         — manual eth_call + eth_sendTransaction encoding
```

No npm. No webpack. Open `tip1023.html` in a browser.

---

## How to run

**Requires a local server for passkey support (Chrome blocks WebAuthn on `file://`)**

```bash
git clone https://github.com/rebulon/tempo-web3-passkey-demo
cd tempo-web3-passkey-demo
python -m http.server 8080
# Open http://localhost:8080/tip1023.html
```

Then:
1. Click **Create Passkey** — browser asks for PIN or Touch ID
2. Click **Get Tokens** — faucet sends 1M of each token
3. Pick a scenario, set amount and recipient
4. Click **GENERATE INTENT →** — sign with passkey or MetaMask
5. Explorer opens automatically after confirmation

---

## Intent payload (TIP-1023)

```
tx_type:       0x49
chain_id:      42431
version:       1
sender:        0x... (passkey-derived or MetaMask address)
fee_token:     0x20c0... (TIP-20 stablecoin)
fee_ceiling:   $0.05 (max fee user pays)
surplus_share: 0–100% (resolver gives back excess to user)
nonce:         timestamp-based
conditions:    PRICE_GTE / BLOCK_GTE / TIMESTAMP_GTE
```

Intent hash: `SHA-256(0x49 || chainId:version:sender:nonce:feeCeiling:surplusShare:feeToken)`

---

## Two transaction paths

**Path A — MetaMask**
`sign tx → eth_sendTransaction → wait receipt → open explorer`

**Path B — Passkey + Tempo Sponsor**
`P-256 sign → POST sponsor.moderato.tempo.xyz → wait receipt → open explorer`

---

## Scenarios

| Scenario | From | To | Condition |
|----------|------|----|-----------|
| FX Swap | pathUSD | AlphaUSD | PRICE_GTE 0.99 |
| Transfer | pathUSD | — | none |
| Payroll Batch | BetaUSD | — | BLOCK_GTE |
| Scheduled | ThetaUSD | — | TIMESTAMP_GTE |

---

## Testnet tokens

| Token | Address |
|-------|---------|
| pathUSD | `0x20c0000000000000000000000000000000000000` |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` |
| BetaUSD | `0x20c0000000000000000000000000000000000002` |
| ThetaUSD | `0x20c0000000000000000000000000000000000003` |

---

## File structure

```
tip1023/
├── tip1023.html      # entry point
├── css/
│   └── style.css
└── js/
    ├── config.js     # RPC endpoints, token addresses, scenarios
    ├── passkey.js    # WebAuthn register / authenticate / sign
    ├── wallet.js     # MetaMask connect + RPC helper
    ├── tokens.js     # balanceOf + faucet + transfer
    ├── intent.js     # buildIntentPayload() + hashIntent()
    └── app.js        # UI logic
```

---

## Network

| | |
|---|---|
| Chain ID | 42431 |
| RPC | https://rpc.moderato.tempo.xyz |
| Explorer | https://explore.tempo.xyz |
| Sponsor | https://sponsor.moderato.tempo.xyz |
| Faucet | `tempo_fundAddress` via RPC |

---

## Roadmap

- [ ] Real secp256k1 key derivation from passkey (WebAuthn PRF extension)
- [ ] Multi-token swap routing via Tempo DEX
- [ ] Batch intents (payroll: N recipients in one intent)
- [ ] Scheduled intents (execute after block / timestamp condition)
- [ ] Merchant checkout widget

---

Built with [Tempo](https://tempo.xyz) — a payments L1 with stablecoin-native fees and intent transactions.
