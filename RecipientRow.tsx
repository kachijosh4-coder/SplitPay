/**
 * RecipientRow — one editable row in the recipient list.
 */
import { Trash2 } from 'lucide-react'

export interface Recipient {
  id: string
  address: string
  basisPoints: string // string so the input stays controlled; parsed when submitted
}

interface Props {
  recipient: Recipient
  index: number
  onChange: (id: string, field: keyof Omit<Recipient, 'id'>, value: string) => void
  onRemove: (id: string) => void
  canRemove: boolean
  addressError?: string
  bpsError?: string
}

export default function RecipientRow({
  recipient,
  index,
  onChange,
  onRemove,
  canRemove,
  addressError,
  bpsError,
}: Props) {
  const glass = {
    inner: {
      background: 'rgba(255,255,255,0.46)',
      border: '1px solid rgba(255,255,255,0.56)',
    } as React.CSSProperties,
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.64)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.68)',
        boxShadow: '0 4px 16px rgba(18,45,69,0.05)',
      }}
    >
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Recipient {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(recipient.id)}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-red-50"
            aria-label={`Remove recipient ${index + 1}`}
          >
            <Trash2 className="size-4" style={{ color: 'var(--danger)' }} />
          </button>
        )}
      </div>

      {/* Address field */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          Wallet address
        </label>
        <div
          className="rounded-xl px-3 py-2.5"
          style={{
            ...glass.inner,
            ...(addressError ? { border: '1px solid var(--danger)' } : {}),
          }}
        >
          <input
            type="text"
            inputMode="text"
            placeholder="0x..."
            value={recipient.address}
            onChange={(e) => onChange(recipient.id, 'address', e.target.value)}
            className="mono w-full bg-transparent text-sm outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {addressError && (
          <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            {addressError}
          </p>
        )}
      </div>

      {/* Percentage field */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          Split percentage
        </label>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            ...glass.inner,
            ...(bpsError ? { border: '1px solid var(--danger)' } : {}),
          }}
        >
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={recipient.basisPoints}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                onChange(recipient.id, 'basisPoints', v)
              }
            }}
            className="display w-full bg-transparent text-xl font-bold tabular-nums outline-none placeholder:text-slate-300"
            style={{ color: 'var(--ink)' }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
            %
          </span>
        </div>
        {bpsError && (
          <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            {bpsError}
          </p>
        )}
      </div>
    </div>
  )
}
