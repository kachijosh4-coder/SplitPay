/**
 * chain-config.ts — single source of truth for the active chain.
 *
 * HOW THE NETWORK IS CHOSEN
 * --------------------------
 * The app targets Arc Testnet by default.
 * Arc Mainnet is activated only when ALL THREE conditions are true at build time:
 *
 *   1. VITE_ENABLE_MAINNET=true      in .env
 *   2. VITE_SPLITPAY_MAINNET_ADDRESS  is set (the deployed mainnet contract address)
 *
 * If either is missing the app falls back to Arc Testnet automatically.
 * This prevents accidental mainnet exposure before the contract is deployed.
 *
 * TO SWITCH TO MAINNET (checklist — do not skip steps):
 *   [ ] Deploy SplitPay.sol to Arc Mainnet from your own wallet
 *       e.g. forge create --rpc-url https://rpc.mainnet.arc.io \
 *                         --private-key $PRIVATE_KEY \
 *                         --broadcast \
 *                         contracts/SplitPay.sol:SplitPay
 *   [ ] Independently verify the deployed contract on the Arc explorer
 *   [ ] Confirm USDC address 0x3600000000000000000000000000000000000000 is live on Arc Mainnet
 *   [ ] Set VITE_SPLITPAY_MAINNET_ADDRESS=<deployed address> in Netlify env vars
 *   [ ] Set VITE_ENABLE_MAINNET=true in Netlify env vars
 *   [ ] Trigger a new Netlify deploy
 *   [ ] Test with the smallest possible real amount before announcing publicly
 *
 * All values are imported from @/onchain-facts so no address or RPC URL is typed here.
 */

import { requireChain, getUsdc } from '@/onchain-facts'
import { usdcDecimalsFor } from '@/onchain-money'

// ── Chain IDs ────────────────────────────────────────────────────────────────
export const ARC_TESTNET_ID  = 5042002
export const ARC_MAINNET_ID  = 5042

// ── Mainnet guard ────────────────────────────────────────────────────────────
// Both env vars must be present for mainnet to activate.
const ENABLE_MAINNET = import.meta.env.VITE_ENABLE_MAINNET === 'true'
const MAINNET_CONTRACT = (import.meta.env.VITE_SPLITPAY_MAINNET_ADDRESS as string | undefined) || ''

/**
 * True when the app is running in mainnet mode.
 * The form, header, and submit button all gate on this.
 */
export const IS_MAINNET = ENABLE_MAINNET && MAINNET_CONTRACT.length > 0

// ── Active chain (resolved once at module init) ──────────────────────────────
export const ACTIVE_CHAIN_ID = IS_MAINNET ? ARC_MAINNET_ID : ARC_TESTNET_ID

/** The full chain descriptor from the registry (name, explorer, RPC, etc.) */
export const ACTIVE_CHAIN = requireChain(ACTIVE_CHAIN_ID)

// ── USDC facts for the active chain ─────────────────────────────────────────
const _usdc = getUsdc(ACTIVE_CHAIN_ID)
if (!_usdc) {
  throw new Error(`No USDC configured for chain ${ACTIVE_CHAIN_ID} in onchain-facts`)
}

/** USDC ERC-20 address on the active chain (same address on both Arc networks) */
export const USDC_ADDRESS  = _usdc.address as `0x${string}`

/** USDC decimal count for the active chain (6 on both Arc networks) */
export const USDC_DECIMALS = usdcDecimalsFor(ACTIVE_CHAIN_ID)

// ── SplitPay contract address ────────────────────────────────────────────────
/**
 * The deployed SplitPay contract address for the active chain.
 *
 * Testnet:  set via VITE_SPLITPAY_ADDRESS      (already deployed)
 * Mainnet:  set via VITE_SPLITPAY_MAINNET_ADDRESS  (set after you deploy)
 *
 * Empty string means the contract is not yet deployed on this network.
 * The form shows a "not yet deployed" placeholder instead of a submit button.
 */
export const SPLITPAY_ADDRESS: `0x${string}` = IS_MAINNET
  ? (MAINNET_CONTRACT as `0x${string}`)
  : ((import.meta.env.VITE_SPLITPAY_ADDRESS as string | undefined) ?? '') as `0x${string}`

/** Human-readable network label shown in the UI and the "switch network" button. */
export const NETWORK_LABEL = IS_MAINNET ? 'Arc' : 'Arc Testnet'

/** Help text shown below the split button. */
export const NETWORK_CAPTION = IS_MAINNET
  ? 'Two wallet signatures required. Real USDC on Arc Mainnet will be transferred.'
  : 'Two wallet signatures required. Each is confirmed on Arc Testnet before the next step begins.'

/** Button label for the wrong-network prompt. */
export const SWITCH_LABEL = IS_MAINNET ? 'Switch to Arc' : 'Switch to Arc Testnet'
