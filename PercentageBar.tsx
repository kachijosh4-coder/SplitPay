/**
 * PercentageBar — shows how much of the 100% total has been allocated.
 */
interface Props {
  totalPercent: number // e.g. 75.5 means 75.5%
}

export default function PercentageBar({ totalPercent }: Props) {
  const clamped = Math.min(100, Math.max(0, totalPercent))
  const over = totalPercent > 100
  const exact = Math.abs(totalPercent - 100) < 0.01
  const remaining = 100 - totalPercent

  const barColor = over
    ? 'var(--danger)'
    : exact
    ? 'var(--success)'
    : 'var(--accent)'

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.46)',
        border: '1px solid rgba(255,255,255,0.56)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Total allocated
        </span>
        <span
          className="display tabular-nums text-sm font-bold"
          style={{ color: over ? 'var(--danger)' : exact ? 'var(--success)' : 'var(--ink)' }}
        >
          {totalPercent.toFixed(2)}%
        </span>
      </div>

      {/* Progress track */}
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, background: barColor }}
        />
      </div>

      {/* Status line */}
      <p className="mt-2 text-xs" style={{ color: over ? 'var(--danger)' : 'var(--subtle)' }}>
        {over
          ? `${(totalPercent - 100).toFixed(2)}% over 100% — reduce some shares`
          : exact
          ? 'Perfect — all 100% is allocated'
          : `${remaining.toFixed(2)}% remaining to allocate`}
      </p>
    </div>
  )
}
