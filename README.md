# SplitPay

Distribute a single USDC payment across multiple wallet addresses in one transaction, using caller-supplied percentage splits. No intermediaries, no waiting.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Web3:** wagmi v2, viem, ConnectKit
- **Contracts:** Solidity 0.8.28, Foundry
- **Chain:** Arc Testnet (Chain ID: 5042002)
- **Token:** USDC (ERC-20, 6 decimals, Arc Testnet)

## What it does

1. Connect a wallet (MetaMask or any injected wallet).
2. Enter a total USDC amount and add up to 20 recipient wallet addresses with percentage splits.
3. The app validates that percentages sum to exactly 100% and that all addresses are valid.
4. Two wallet confirmations: first to approve USDC spending, then to call the SplitPay contract.
5. The contract distributes USDC to every recipient atomically. If any transfer fails the whole transaction reverts.
6. After confirmation a receipt shows each recipient's amount and a link to the Arc block explorer.

## Development

### Prerequisites

- [Bun](https://bun.sh) v1+
- [Foundry](https://getfoundry.sh) (for contract work)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_SPLITPAY_ADDRESS` | Deployed SplitPay contract address. Required for the split button to activate. Leave blank until the contract is deployed. |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 Project ID. Required for MetaMask Mobile, Trust Wallet, and WalletConnect QR-code flow. Optional for desktop-only use. Free at https://cloud.walletconnect.com |
| `RPC_PROXY_BASE_URL` | Arc Studio-provisioned RPC proxy base URL. Optional outside Arc Studio. |
| `RPC_PROXY_TOKEN` | Arc Studio-provisioned RPC proxy auth token. Optional outside Arc Studio. |
| `RPC_PROXY_CHAINS` | Comma-separated list of chains served by the proxy. Optional outside Arc Studio. |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Contracts

```bash
# Build contracts
bun run contracts:build

# Run unit tests (26 tests across happy path, reverts, and fuzz cases)
bun run contracts:test
```

## Contract architecture

`contracts/SplitPay.sol` — a stateless, permissionless ERC-20 splitter.

- One function: `split(address usdcToken, address[] recipients, uint256[] basisPoints, uint256 totalAmount)`
- Caller approves the contract for `totalAmount`, then calls `split`.
- Uses integer arithmetic with the last recipient absorbing any rounding dust.
- Protected by OpenZeppelin `ReentrancyGuard`.
- No owner, no admin, no stored state beyond the reentrancy lock.

Test files live in `contracts/test/`. A mock token helper is in `contracts/test-helpers/`.
