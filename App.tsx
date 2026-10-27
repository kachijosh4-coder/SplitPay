/*
 * SplitPay — distribute USDC among multiple recipients in one transaction.
 * Built with Arc Studio · https://studio.arc.io
 */
import WalletBar from './components/WalletBar'
import SplitForm from './components/SplitForm'

export default function App() {
  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Soft background blobs for depth */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div
          style={{
            position: 'absolute',
            top: '5%',
            left: '2%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(133,177,237,0.20) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '4%',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,205,131,0.18) 0%, transparent 70%)',
            filter: 'blur(58px)',
          }}
        />
      </div>

      {/* Sticky header */}
      <WalletBar />

      {/* Page content */}
      <main className="relative z-10 mx-auto max-w-md px-4 pb-16 pt-8">
        {/* Hero copy */}
        <div className="mb-8 text-center">
          <h1
            className="display text-3xl font-bold"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Split USDC instantly
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            Distribute a single USDC payment across multiple wallets in one transaction — no
            intermediaries, no waiting.
          </p>
        </div>

        <SplitForm />
      </main>
    </div>
  )
}
