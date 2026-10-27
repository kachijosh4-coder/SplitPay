/**
 * TransactionReceipt — success card shown after a confirmed split.
 */
import { CheckCircle, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { Amount } from '@/onchain-money'

interface RecipientResult {
  address: string
  amount: bigint
  decimals: number
}

interface Props {
  txHash: `0x${string}`
  chainId: number
  recipients: RecipientResult[]
  totalAmount: bigint
  decimals: number
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function TransactionReceipt({ txHash, chainId, recipients, totalAmount, decimals }: Props) {
  const explorerUrl = buildTxExplorerUrl(chainId, txHash)

  return (
    <div
      className="rounded-3xl p-5 space-y-4"
      style={{
        background: 'rgba(255,255,255,0.64)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.68)',
        boxShadow: '0 8px 32px rgba(18,45,69,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-full"
          style={{ background: 'rgba(26,128,71,0.12)' }}
        >
          <CheckCircle className="size-5" style={{ color: 'var(--success)' }} />
        </div>
        <div>
          <p className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
            Split confirmed!
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {Amount.fromRaw(totalAmount, decimals).toFixed(2)} USDC distributed to {recipients.length} recipient
            {recipients.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Per-recipient breakdown */}
      <div className="space-y-2">
        {recipients.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
          >
            <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>
              {formatAddr(r.address)}
            </span>
            <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              {Amount.fromRaw(r.amount, r.decimals).toFixed(2)} USDC
            </span>
          </div>
        ))}
      </div>

      {/* Explorer link */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}
      >
        View on Arc Explorer
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  )
}
