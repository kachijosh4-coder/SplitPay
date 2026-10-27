/**
 * WalletBar — header strip showing connect button + wallet address + USDC balance
 */
import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { Amount } from '@/onchain-money'
import { Wallet, AlertTriangle } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { hasWalletConnect } from '@/wallet-config'
import {
  ACTIVE_CHAIN_ID,
  ACTIVE_CHAIN,
  USDC_ADDRESS,
  USDC_DECIMALS,
  IS_MAINNET,
} from '@/chain-config'

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function WalletBar() {
  const { address, isConnected } = useAccount()

  const { data: rawBalance, isLoading: balanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!address },
  })

  const formattedBalance =
    rawBalance != null
      ? Amount.fromRaw(rawBalance, USDC_DECIMALS).toFixed(2)
      : null

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* WalletConnect missing banner — shown until Project ID is configured */}
      {!hasWalletConnect && (
        <div
          className="flex items-start gap-2.5 px-4 py-2.5"
          style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: '#d97706' }} />
          <p className="text-xs leading-snug" style={{ color: '#92400e' }}>
            <strong>Trust Wallet / WalletConnect not available.</strong> Add{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">
              VITE_WALLETCONNECT_PROJECT_ID
            </code>{' '}
            to <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">.env</code> to
            enable QR-code connection for Trust Wallet, MetaMask Mobile, and other WalletConnect
            wallets. Free at{' '}
            <a
              href="https://cloud.walletconnect.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: '#b45309' }}
            >
              cloud.walletconnect.com
            </a>
            .
          </p>
        </div>
      )}

      <div
        className="w-full"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid var(--border)',
        }}
      >
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            SplitPay
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={IS_MAINNET
              ? { background: 'rgba(186,43,76,0.12)', color: 'var(--danger)' }
              : { background: 'var(--surface-muted)', color: 'var(--muted)' }
            }
          >
            {ACTIVE_CHAIN.name}
          </span>
        </div>

        {/* Wallet area */}
        {isConnected && address ? (
          <div className="flex items-center gap-2.5">
            {/* Balance chip */}
            <div
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 sm:flex"
              style={{
                background: 'rgba(255,255,255,0.64)',
                border: '1px solid var(--border)',
              }}
            >
              <TokenUSDC variant="branded" size={14} />
              <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {balanceLoading ? '…' : (formattedBalance ?? '—')}
              </span>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                USDC
              </span>
            </div>

            {/* Address chip */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: 'rgba(255,255,255,0.64)',
                border: '1px solid var(--border)',
              }}
            >
              <Wallet className="size-3.5" style={{ color: 'var(--muted)' }} />
              <span className="mono text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
                {formatAddr(address)}
              </span>
            </div>
          </div>
        ) : (
          <ConnectKitButton label="Connect Wallet" />
        )}
      </div>
      </div>
    </header>
  )
}
