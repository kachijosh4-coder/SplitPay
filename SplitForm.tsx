/**
 * SplitForm — the main UI for entering a USDC amount and recipients.
 *
 * Flow:
 *  1. User enters total USDC amount.
 *  2. User adds recipients with wallet addresses and split percentages.
 *  3. On submit: approve USDC → call SplitPay.split().
 *  4. Show receipt with per-recipient amounts and explorer link.
 */
import { useState, useCallback, useMemo, useId } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract, usePublicClient } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'

import {
  ACTIVE_CHAIN_ID as CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  SPLITPAY_ADDRESS as SPLIT_PAY_ADDRESS,
  IS_MAINNET,
  SWITCH_LABEL,
  NETWORK_CAPTION,
} from '@/chain-config'
import { parseAmount, Amount } from '@/onchain-money'
import RecipientRow, { type Recipient } from './RecipientRow'
import PercentageBar from './PercentageBar'
import TransactionReceipt from './TransactionReceipt'

// Chain / contract constants are imported from @/chain-config.
// To switch networks, change VITE_ENABLE_MAINNET and VITE_SPLITPAY_MAINNET_ADDRESS in .env.

// ─── SplitPay ABI (only what we need) ────────────────────────────────────────
const SPLITPAY_ABI = [
  {
    name: 'split',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usdcToken', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'basisPoints', type: 'uint256[]' },
      { name: 'totalAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'Split',
    type: 'event',
    inputs: [
      { name: 'initiator', type: 'address', indexed: true },
      { name: 'usdcToken', type: 'address', indexed: false },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipients', type: 'address[]', indexed: false },
      { name: 'amounts', type: 'uint256[]', indexed: false },
    ],
  },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────
function newRecipient(): Recipient {
  return { id: crypto.randomUUID(), address: '', basisPoints: '' }
}

/** Convert a percentage string ("33.33") → basis points bigint (3333n) */
function pctToBps(pct: string): bigint | null {
  const n = parseFloat(pct)
  if (isNaN(n) || n <= 0 || n > 100) return null
  return BigInt(Math.round(n * 100))
}

/** Parse error message from a contract revert or wallet rejection */
function parseError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? ''
  if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance or allowance.'
  if (msg.includes('BasisPointsSumMustBe10000')) return 'Percentages must add up to exactly 100%.'
  if (msg.includes('ZeroRecipient') || msg.includes('ZeroTokenAddress')) return 'Invalid address detected.'
  if (msg.includes('InvalidRecipientCount')) return 'You need between 1 and 20 recipients.'
  if (msg.includes('ERC20TransferFailed')) return 'Transfer to one recipient failed — they may be blocklisted.'
  if (msg.includes('ERC20TransferFromFailed')) return 'USDC approval failed. Try approving again.'
  if (msg.includes('RecipientIsContract')) return 'SplitPay itself cannot be a recipient.'
  return 'Something went wrong. Please try again.'
}

// ─── Component ───────────────────────────────────────────────────────────────
interface ReceiptData {
  txHash: `0x${string}`
  recipients: { address: string; amount: bigint; decimals: number }[]
  totalAmount: bigint
}

export default function SplitForm() {
  const formId = useId()

  // Wallet state
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = isConnected && walletChainId !== CHAIN_ID

  // Form state
  const [amountInput, setAmountInput] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient(), newRecipient()])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'form' | 'approving' | 'confirming-approval' | 'splitting' | 'confirming-split' | 'done'>('form')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // USDC balance
  const { data: rawBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })
  const formattedBalance =
    rawBalance != null
      ? Amount.fromRaw(rawBalance, USDC_DECIMALS).toFixed(2)
      : null

  // Public client for awaiting receipts imperatively inside handleSubmit
  const publicClient = usePublicClient({ chainId: CHAIN_ID })

  // Contract write hooks
  const { writeContractAsync: approveUsdc } = useWriteContract()
  const { writeContractAsync: callSplit } = useWriteContract()

  // Track confirmation for the split tx (used by the receipt hook for UI only)
  const [splitTxHash, setSplitTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: splitTxHash,
    query: { enabled: !!splitTxHash },
  })

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalPercent = useMemo(() => {
    return recipients.reduce((sum, r) => {
      const n = parseFloat(r.basisPoints)
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
  }, [recipients])

  const parsedAmount = useMemo(() => {
    if (!amountInput) return null
    try {
      return parseAmount(CHAIN_ID, amountInput)
    } catch {
      return null
    }
  }, [amountInput])

  // Per-recipient computed amounts (for display only, before transaction)
  const previewAmounts = useMemo(() => {
    if (!parsedAmount) return []
    const total = parsedAmount.raw
    const bpsValues = recipients.map((r) => {
      const n = pctToBps(r.basisPoints)
      return n ?? 0n
    })
    const amounts: bigint[] = []
    let distributed = 0n
    for (let i = 0; i < bpsValues.length; i++) {
      if (i === bpsValues.length - 1) {
        amounts.push(total - distributed)
      } else {
        const share = (total * bpsValues[i]) / 10000n
        amounts.push(share)
        distributed += share
      }
    }
    return amounts
  }, [parsedAmount, recipients])

  // ── Recipient management ───────────────────────────────────────────────────
  const handleRecipientChange = useCallback(
    (id: string, field: keyof Omit<Recipient, 'id'>, value: string) => {
      setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[`${id}-${field}`]
        return next
      })
    },
    [],
  )

  const handleRemove = useCallback((id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleAddRecipient = useCallback(() => {
    setRecipients((prev) => [...prev, newRecipient()])
  }, [])

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Record<string, string> = {}

    if (!amountInput || parseFloat(amountInput) <= 0) {
      errors['amount'] = 'Enter a valid USDC amount greater than 0.'
    }

    if (parsedAmount && rawBalance != null) {
      if (parsedAmount.raw > (rawBalance)) {
        errors['amount'] = `Insufficient balance. You have ${formattedBalance ?? '0'} USDC.`
      }
    }

    if (recipients.length < 1 || recipients.length > 20) {
      errors['recipients'] = 'You need between 1 and 20 recipients.'
    }

    recipients.forEach((r) => {
      if (!r.address || !isAddress(r.address)) {
        errors[`${r.id}-address`] = 'Enter a valid wallet address (0x…).'
      } else if (r.address.toLowerCase() === SPLIT_PAY_ADDRESS.toLowerCase()) {
        errors[`${r.id}-address`] = 'Cannot send to the SplitPay contract itself.'
      }

      if (!r.basisPoints || parseFloat(r.basisPoints) <= 0) {
        errors[`${r.id}-basisPoints`] = 'Percentage must be greater than 0.'
      } else if (parseFloat(r.basisPoints) > 100) {
        errors[`${r.id}-basisPoints`] = 'Percentage cannot exceed 100.'
      }
    })

    const sumBps = recipients.reduce((acc, r) => {
      const n = pctToBps(r.basisPoints)
      return acc + (n ?? 0n)
    }, 0n)

    if (sumBps !== 10000n) {
      errors['bpsSum'] = `Percentages must add up to exactly 100% (currently ${totalPercent.toFixed(2)}%).`
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (!parsedAmount || !address || !publicClient) return

    const totalRaw = parsedAmount.raw
    const recipientAddrs = recipients.map((r) => r.address as `0x${string}`)
    const bpsArr = recipients.map((r) => pctToBps(r.basisPoints)!)

    try {
      // ── Step 1: Submit USDC approval, wait for wallet signature ─────────────
      setStep('approving')
      let approveTxHash: `0x${string}`
      try {
        approveTxHash = await approveUsdc({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SPLIT_PAY_ADDRESS, totalRaw],
          chainId: CHAIN_ID,
        })
      } catch (err) {
        // Wallet rejection or submission failure — stop here, do not proceed.
        throw err
      }

      // ── Step 2: Wait for approval to be confirmed on-chain ──────────────────
      setStep('confirming-approval')
      toast.info('Approval submitted — waiting for on-chain confirmation…')

      const approvalReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
        confirmations: 1,
      })

      // A reverted approval tx (status "reverted") must stop the flow.
      if (approvalReceipt.status !== 'success') {
        throw new Error('USDC approval transaction was reverted on-chain.')
      }

      toast.success('Approval confirmed — submitting split…')

      // ── Step 3: Submit the split transaction ─────────────────────────────────
      setStep('splitting')
      const splitTx = await callSplit({
        address: SPLIT_PAY_ADDRESS,
        abi: SPLITPAY_ABI,
        functionName: 'split',
        args: [USDC_ADDRESS, recipientAddrs, bpsArr, totalRaw],
        chainId: CHAIN_ID,
      })

      // ── Step 4: Wait for split confirmation ──────────────────────────────────
      setStep('confirming-split')
      setSplitTxHash(splitTx)
      toast.info('Split submitted — waiting for on-chain confirmation…')

      const splitReceipt = await publicClient.waitForTransactionReceipt({
        hash: splitTx,
        confirmations: 1,
      })

      if (splitReceipt.status !== 'success') {
        throw new Error('Split transaction was reverted on-chain.')
      }

      // ── Step 5: Show receipt ──────────────────────────────────────────────────
      const receiptRecipients = recipients.map((r, i) => ({
        address: r.address,
        amount: previewAmounts[i] ?? 0n,
        decimals: USDC_DECIMALS,
      }))

      setReceipt({ txHash: splitTx, recipients: receiptRecipients, totalAmount: totalRaw })
      setStep('done')
      toast.success('Split confirmed on-chain!')
    } catch (err) {
      setStep('form')
      setSplitTxHash(undefined)
      const msg = parseError(err)
      toast.error(msg)
      setFormErrors((prev) => ({ ...prev, submit: msg }))
    }
  }

  function handleReset() {
    setAmountInput('')
    setRecipients([newRecipient(), newRecipient()])
    setFormErrors({})
    setStep('form')
    setReceipt(null)
    setSplitTxHash(undefined)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isBusy =
    step === 'approving' ||
    step === 'confirming-approval' ||
    step === 'splitting' ||
    step === 'confirming-split' ||
    isConfirming

  if (step === 'done' && receipt) {
    return (
      <div className="space-y-4">
        <TransactionReceipt
          txHash={receipt.txHash}
          chainId={CHAIN_ID}
          recipients={receipt.recipients}
          totalAmount={receipt.totalAmount}
          decimals={USDC_DECIMALS}
        />
        <button
          onClick={handleReset}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:opacity-80"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
        >
          New split
        </button>
      </div>
    )
  }

  return (
    <form id={formId} onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4" noValidate>

      {/* ── Mainnet warning ── shown only in mainnet mode ── */}
      {IS_MAINNET && (
        <div
          className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.25)' }}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs leading-snug" style={{ color: 'var(--danger)' }}>
            <strong>You are on Arc Mainnet.</strong> This transaction uses real USDC.
            Verify all recipient addresses and amounts carefully before confirming.
          </p>
        </div>
      )}

      {/* ── Amount card ── */}
      <section
        className="rounded-3xl p-5"
        style={{
          background: 'rgba(255,255,255,0.64)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.68)',
          boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <TokenUSDC variant="branded" size={18} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Total to split
          </span>
        </div>

        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.46)',
            border: formErrors['amount'] ? '1px solid var(--danger)' : '1px solid rgba(255,255,255,0.56)',
          }}
        >
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amountInput}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d*$/.test(v)) {
                setAmountInput(v)
                setFormErrors((p) => { const n = { ...p }; delete n['amount']; return n })
              }
            }}
            disabled={isBusy}
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300 disabled:opacity-50"
            style={{ color: 'var(--ink)' }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
            {formattedBalance != null && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setAmountInput(formattedBalance)
                  setFormErrors((p) => { const n = { ...p }; delete n['amount']; return n })
                }}
                className="text-xs font-semibold disabled:opacity-40"
                style={{ color: 'var(--accent-hover)' }}
              >
                Balance: {formattedBalance} · Max
              </button>
            )}
          </div>
        </div>

        {formErrors['amount'] && (
          <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="size-3.5 shrink-0" />
            {formErrors['amount']}
          </p>
        )}
      </section>

      {/* ── Recipients ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Recipients
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {recipients.length} / 20
          </span>
        </div>

        {recipients.map((r, i) => (
          <RecipientRow
            key={r.id}
            recipient={r}
            index={i}
            onChange={handleRecipientChange}
            onRemove={handleRemove}
            canRemove={recipients.length > 1 && !isBusy}
            addressError={formErrors[`${r.id}-address`]}
            bpsError={formErrors[`${r.id}-basisPoints`]}
          />
        ))}

        {recipients.length < 20 && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleAddRecipient}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.46)',
              border: '1.5px dashed var(--border-strong)',
              color: 'var(--ink-2)',
            }}
          >
            <Plus className="size-4" />
            Add recipient
          </button>
        )}
      </div>

      {/* ── Percentage bar ── */}
      <PercentageBar totalPercent={totalPercent} />

      {/* ── Preview amounts ── */}
      {parsedAmount && previewAmounts.length > 0 && Math.abs(totalPercent - 100) < 0.01 && (
        <section
          className="rounded-2xl p-4 space-y-2"
          style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Preview amounts
          </p>
          {recipients.map((r, i) => (
            <div key={r.id} className="flex items-center justify-between">
              <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>
                {r.address && isAddress(r.address)
                  ? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`
                  : `Recipient ${i + 1}`}
              </span>
              <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {Amount.fromRaw(previewAmounts[i] ?? 0n, USDC_DECIMALS).toFixed(2)} USDC
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── Global form error ── */}
      {(formErrors['bpsSum'] || formErrors['submit']) && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.2)' }}
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {formErrors['bpsSum'] ?? formErrors['submit']}
          </p>
        </div>
      )}

      {/* ── CTA ── */}
      {!isConnected ? (
        <div className="flex justify-center">
          <ConnectKitButton label="Connect wallet to split" />
        </div>
      ) : wrongChain ? (
        <button
          type="button"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          disabled={isSwitching}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {isSwitching ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Switching network…
            </span>
          ) : (
            SWITCH_LABEL
          )}
        </button>
      ) : !SPLIT_PAY_ADDRESS ? (
        <div
          className="rounded-xl px-4 py-3 text-center text-sm"
          style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
        >
          Contract not yet deployed — address will appear here after deployment.
        </div>
      ) : (
        <button
          type="submit"
          form={formId}
          disabled={isBusy}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {step === 'approving' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Step 1 of 4 — Confirm approval in wallet…
            </span>
          ) : step === 'confirming-approval' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Step 2 of 4 — Waiting for approval on-chain…
            </span>
          ) : step === 'splitting' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Step 3 of 4 — Confirm split in wallet…
            </span>
          ) : step === 'confirming-split' || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Step 4 of 4 — Waiting for split on-chain…
            </span>
          ) : (
            'Split USDC'
          )}
        </button>
      )}

      {/* Help text */}
      <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
        {NETWORK_CAPTION}
      </p>
    </form>
  )
}
