/**
 * Non-React wallet configuration constants.
 * Kept in a separate module (no React component exports) so Vite's React Fast
 * Refresh plugin never flags this file and forces a full page reload.
 */

/**
 * WalletConnect v2 Project ID.
 *
 * HOW TO SET THIS IN ARC STUDIO:
 *  1. Go to https://cloud.walletconnect.com and sign up for a free account.
 *  2. Create a new project (any name, "Web" type).
 *  3. Copy the Project ID from the project dashboard.
 *  4. Open the Code panel in Arc Studio, click the file tree, open `.env`.
 *  5. Add this line:   VITE_WALLETCONNECT_PROJECT_ID=paste_your_id_here
 *  6. Save — the dev server restarts automatically and picks up the new value.
 *
 * Without this, the WalletConnect / "Browser" connector is disabled.
 * MetaMask desktop (browser extension) and the MetaMask in-app browser still
 * work via the injected() connector without a Project ID.
 */
export const WC_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) || ''

/**
 * True when WalletConnect is configured and the QR / deep-link flow is available.
 * Used in WalletBar to show a hint for mobile users.
 */
export const hasWalletConnect = WC_PROJECT_ID.length > 0

export const APP_NAME = 'SplitPay'
export const APP_DESCRIPTION =
  'Split USDC payments among multiple recipients in one transaction.'
