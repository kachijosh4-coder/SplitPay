# SplitPay

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** — what Arc Studio remembers about building this app.

---

## What This App Does

SplitPay lets a user distribute a USDC payment among multiple recipients in one transaction,
using basis-point percentage splits. Built for Arc Testnet with a beginner-friendly UI and a
stateless, permissionless smart contract.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC (6 decimals, address: `0x3600000000000000000000000000000000000000`, Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` — app shell + background blobs
- `src/components/WalletBar.tsx` — sticky header with wallet connect + USDC balance
- `src/components/SplitForm.tsx` — main form: amount, recipients, approval → split flow
- `src/components/RecipientRow.tsx` — address + percentage input row
- `src/components/PercentageBar.tsx` — live 0–100% allocation tracker
- `src/components/TransactionReceipt.tsx` — post-split success card with explorer link
- `contracts/SplitPay.sol` — stateless USDC splitter contract
- `contracts/test/` — 26 Foundry unit + fuzz tests

## Contract Deployments

| Contract | Chain | Address | Explorer |
|---|---|---|---|
| SplitPay | Arc Testnet (ARC-TESTNET, chain ID 5042002) | `0x1cd836824def63b92abfb7603c290ff75777ff1f` | [View on explorer](https://explorer.testnet.arc.io/address/0x1cd836824def63b92abfb7603c290ff75777ff1f) |

**Deploy tx:** `0xfcfd6407acde6dcf4041121dadb37935ae2dcc5c337cf14cc2a382778534515c`
**Deployed at:** 2026-10-26T02:18:20.425Z
**Constructor args:** none
**Deployer wallet ID:** `3c2464b2-8369-52e2-a782-800bbeca5396` (Circle platform wallet)

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SPLITPAY_ADDRESS` | Deployed SplitPay contract address on **Arc Testnet** |
| `VITE_SPLITPAY_MAINNET_ADDRESS` | Deployed SplitPay contract address on **Arc Mainnet** — set after mainnet deploy |
| `VITE_ENABLE_MAINNET` | Set to `true` to activate mainnet mode (requires `VITE_SPLITPAY_MAINNET_ADDRESS` also set) |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 Project ID for mobile wallet QR/deep-link flow |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy base (optional outside Arc Studio) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy token (optional outside Arc Studio) |
| `RPC_PROXY_CHAINS` | Comma-separated proxy chain keys (optional outside Arc Studio) |

## To Run

```bash
bun install
bun run dev
```

## Contract Notes

- SplitPay is stateless and permissionless — no owner, no admin, no upgradability.
- USDC address is passed at call time, not hardcoded in the contract.
- Last recipient absorbs integer-division dust so full `totalAmount` is always distributed.
- Max 20 recipients per split.
- The contract's own address is rejected as a recipient.
- Balanced security review passed; 26/26 unit + fuzz tests pass.
