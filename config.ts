/**
 * wagmi configuration for SplitPay.
 *
 * Both Arc Testnet and Arc Mainnet are registered so wagmi can handle
 * chain-switching prompts correctly. The ACTIVE chain is determined by
 * chain-config.ts — this file just makes sure both are available to wagmi.
 *
 * CONNECTOR CHOICES:
 *
 * injected({ target: 'metaMask' })
 *   ConnectKit's own source uses this exact call (not plain injected()).
 *   target:'metaMask' makes ConnectKit label the entry "MetaMask" with the
 *   fox icon by checking window.ethereum.isMetaMask. Works on desktop with
 *   MetaMask extension and inside MetaMask's in-app browser on iOS.
 *
 * walletConnect({ showQrModal: false, ... })
 *   showQrModal:false is required — ConnectKit renders the QR in its own modal.
 *   Passing showQrModal:true launches a second modal underneath ConnectKit's,
 *   causing the "loads forever" symptom. Only registered when
 *   VITE_WALLETCONNECT_PROJECT_ID is set; absent means injected-only.
 *
 * coinbaseWallet — INTENTIONALLY OMITTED.
 *   The Coinbase Wallet SDK v4 (base_account_sdk) installs an invisible
 *   background overlay in iOS Safari that intercepts touch events at the
 *   top of the z-stack, blocking MetaMask and other buttons.
 *
 * This file exports only the wagmi Config object (no bare value exports)
 * so Vite React Fast Refresh never flags this file and forces a page reload.
 * Non-React constants live in wallet-config.ts and chain-config.ts.
 */

import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet, arc } from 'viem/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { WC_PROJECT_ID, APP_NAME, APP_DESCRIPTION } from './wallet-config'
import { ARC_TESTNET_ID, ARC_MAINNET_ID } from './chain-config'
import { requireChain } from './onchain-facts'

// Register both Arc chains for RPC tracing.
registerChain(arcTestnet.id, requireChain(ARC_TESTNET_ID).rpcUrls[0])
registerChain(arc.id,        requireChain(ARC_MAINNET_ID).rpcUrls[0])

const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'https://studio.arc.io'

const connectors = [
  // Shows as "MetaMask" by name in ConnectKit's modal (not generic "Browser").
  // Works on desktop extension and inside MetaMask's built-in iOS browser.
  injected({ target: 'metaMask' }),

  // WalletConnect v2: QR-code + deep link for mobile wallets in Safari.
  // showQrModal:false because ConnectKit renders the QR itself.
  // Registered only when a Project ID is available.
  ...(WC_PROJECT_ID
    ? [
        walletConnect({
          projectId: WC_PROJECT_ID,
          showQrModal: false,
          metadata: {
            name: APP_NAME,
            description: APP_DESCRIPTION,
            url: APP_URL,
            icons: [`${APP_URL}/favicon.ico`],
          },
        }),
      ]
    : []),
]

export const config = createConfig({
  // Both Arc chains registered so the wallet can be prompted to switch.
  // mainnet (Ethereum) stays for ENS resolution only — no SplitPay txs go there.
  chains: [arcTestnet, arc, mainnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(requireChain(ARC_TESTNET_ID).rpcUrls[0]),
    [arc.id]:        http(requireChain(ARC_MAINNET_ID).rpcUrls[0]),
    [mainnet.id]:    http(),
  },
  // Disable MIPD: on mobile there is only one injected provider (MetaMask)
  // and MIPD can surface duplicate phantom entries in ConnectKit's modal.
  multiInjectedProviderDiscovery: false,
})
