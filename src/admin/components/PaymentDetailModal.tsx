import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { adminApi } from '../api'
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatPaise,
  paiseToRupeeInput,
  rupeesToPaise,
  todayInputValue,
} from '../format'
import type { PaymentDetailResponse, PaymentMethod } from '../types'
import { AdminModal, Spinner, StatusBadge } from './ui'
import { useToast } from './useToast'

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const inputClass =
  'w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none transition-colors focus:border-accent'

interface PaymentDetailModalProps {
  paymentId: string | null
  onClose: () => void
  onChanged: () => void
}

export function PaymentDetailModal({
  paymentId,
  onClose,
  onChanged,
}: PaymentDetailModalProps) {
  const { notify } = useToast()
  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayInputValue())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [replaceEnabled, setReplaceEnabled] = useState(false)
  const [replaceAmount, setReplaceAmount] = useState('')
  const [correctError, setCorrectError] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState(false)

  const load = useCallback(async () => {
    if (!paymentId) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await adminApi.payments.get(paymentId)
      setDetail(data)
      setAmount(paiseToRupeeInput(data.payment.balancePaise))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load payment')
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => {
    if (!paymentId) {
      setDetail(null)
      return
    }
    setPaymentDate(todayInputValue())
    setMethod('cash')
    setReference('')
    setNotes('')
    setFormError(null)
    setCorrectingId(null)
    setReason('')
    setReplaceEnabled(false)
    setReplaceAmount('')
    setCorrectError(null)
    void load()
  }, [paymentId, load])

  const payment = detail?.payment

  const submitRecord = async (event: FormEvent) => {
    event.preventDefault()
    if (!paymentId) return
    const amountPaise = rupeesToPaise(amount)
    if (amountPaise <= 0) {
      setFormError('Enter an amount greater than zero')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await adminApi.payments.recordEntry(paymentId, {
        amountPaise,
        paymentDate,
        method,
        referenceNumber: reference.trim() || null,
        notes: notes.trim() || null,
      })
      notify('Payment recorded', 'success')
      setReference('')
      setNotes('')
      await load()
      onChanged()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCorrection = async (entryId: string) => {
    if (!paymentId) return
    setCorrecting(true)
    setCorrectError(null)
    try {
      await adminApi.payments.correct(paymentId, {
        entryId,
        reason: reason.trim(),
        replacement: replaceEnabled
          ? {
              amountPaise: rupeesToPaise(replaceAmount),
              paymentDate,
              method,
              referenceNumber: reference.trim() || null,
              notes: notes.trim() || null,
            }
          : undefined,
      })
      notify('Payment entry corrected', 'success')
      setCorrectingId(null)
      setReason('')
      setReplaceEnabled(false)
      setReplaceAmount('')
      await load()
      onChanged()
    } catch (error) {
      setCorrectError(
        error instanceof Error ? error.message : 'Unable to apply correction',
      )
    } finally {
      setCorrecting(false)
    }
  }

  return (
    <AdminModal
      open={Boolean(paymentId)}
      onClose={onClose}
      size="lg"
      title={payment ? formatMonth(payment.billingMonth) : 'Billing record'}
      description={
        detail?.member
          ? `${detail.member.fullName} · ${detail.member.memberId} · ${detail.member.phone}`
          : undefined
      }
    >
      {loading && !detail ? (
        <div className="flex items-center justify-center gap-3 py-12">
          <Spinner />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
            Loading record…
          </span>
        </div>
      ) : loadError ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-sm text-red-300">
          {loadError}
        </p>
      ) : payment ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCell label="Due" value={formatPaise(payment.dueAmountPaise)} />
            <SummaryCell label="Paid" value={formatPaise(payment.amountPaidPaise)} />
            <SummaryCell
              label="Balance"
              value={formatPaise(payment.balancePaise)}
              tone={payment.balancePaise > 0 ? 'accent' : 'lime'}
            />
            <div className="rounded-md border border-hairline bg-canvas p-3">
              <p className="label-telemetry">Status</p>
              <div className="mt-2">
                <StatusBadge status={payment.status} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-hairline bg-canvas">
            <div className="border-b border-hairline px-4 py-2">
              <p className="label-telemetry">Payment entries</p>
            </div>
            {payment.paymentEntries.length === 0 ? (
              <p className="px-4 py-6 text-center font-body text-sm text-dim">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {payment.paymentEntries.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={entry.voided ? 'opacity-50' : undefined}>
                        <p
                          className={`font-body text-sm ${
                            entry.voided ? 'text-muted line-through' : 'text-white'
                          }`}
                        >
                          {formatPaise(entry.amountPaise)} ·{' '}
                          <span className="capitalize">{entry.method.replace('_', ' ')}</span>
                        </p>
                        <p className="font-mono text-[0.6875rem] text-dim">
                          {formatDate(entry.paymentDate)}
                          {entry.referenceNumber ? ` · ${entry.referenceNumber}` : ''}
                          {entry.recordedByName ? ` · by ${entry.recordedByName}` : ''}
                        </p>
                        {entry.voided ? (
                          <p className="mt-1 font-body text-xs text-red-300">
                            Voided{entry.voidedByName ? ` by ${entry.voidedByName}` : ''} ·{' '}
                            {entry.voidReason}
                          </p>
                        ) : null}
                      </div>
                      {!entry.voided ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCorrectingId(entry.id)
                            setReason('')
                            setReplaceEnabled(false)
                            setReplaceAmount(paiseToRupeeInput(entry.amountPaise))
                            setCorrectError(null)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Correct
                        </button>
                      ) : null}
                    </div>

                    {correctingId === entry.id ? (
                      <div className="mt-3 space-y-3 rounded-md border border-accent/30 bg-surface p-3">
                        <div>
                          <label className="label-telemetry mb-1.5 block">
                            Correction reason
                          </label>
                          <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Why is this entry being voided?"
                            className={inputClass}
                          />
                        </div>
                        <label className="flex items-center gap-2 font-body text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={replaceEnabled}
                            onChange={(event) => setReplaceEnabled(event.target.checked)}
                            className="h-4 w-4 accent-[#FFEE00]"
                          />
                          Add a replacement payment
                        </label>
                        {replaceEnabled ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="label-telemetry mb-1.5 block">
                                Amount (₹)
                              </label>
                              <input
                                value={replaceAmount}
                                onChange={(event) => setReplaceAmount(event.target.value)}
                                inputMode="decimal"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="label-telemetry mb-1.5 block">
                                Payment date
                              </label>
                              <input
                                type="date"
                                value={paymentDate}
                                onChange={(event) => setPaymentDate(event.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        ) : null}
                        {correctError ? (
                          <p className="font-body text-xs text-red-300">{correctError}</p>
                        ) : null}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setCorrectingId(null)}
                            className="rounded-md border border-hairline px-3 py-2 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={correcting}
                            onClick={() => submitCorrection(entry.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-3 py-2 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:opacity-60"
                          >
                            {correcting ? <Spinner className="text-canvas" /> : null}
                            Confirm correction
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {payment.balancePaise > 0 ? (
            <form
              onSubmit={submitRecord}
              className="space-y-3 rounded-md border border-hairline bg-canvas p-4"
            >
              <p className="label-telemetry">Record a payment</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-telemetry mb-1.5 block">Amount (₹)</label>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="label-telemetry mb-1.5 block">Payment date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="label-telemetry mb-1.5 block">Method</label>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                    className={inputClass}
                  >
                    {methodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-telemetry mb-1.5 block">
                    Reference (optional)
                  </label>
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="label-telemetry mb-1.5 block">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="font-body text-xs text-red-300">{formError}</p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:opacity-60"
                >
                  {submitting ? <Spinner className="text-canvas" /> : null}
                  Record payment
                </button>
              </div>
            </form>
          ) : (
            <p className="rounded-md border border-lime/30 bg-lime/10 px-4 py-3 font-body text-sm text-lime">
              This bill is fully paid.
            </p>
          )}

          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
            Due {formatDate(payment.dueDate)} · Created {formatDateTime(payment.createdAt)}
          </p>
        </div>
      ) : null}
    </AdminModal>
  )
}

function SummaryCell({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'lime'
}) {
  const toneClass = {
    default: 'text-white',
    accent: 'text-accent',
    lime: 'text-lime',
  }[tone]
  return (
    <div className="rounded-md border border-hairline bg-canvas p-3">
      <p className="label-telemetry">{label}</p>
      <p className={`mt-2 font-display text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}
