import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Receipt, Search, Sparkles } from 'lucide-react'
import { adminApi } from '../api'
import { currentMonthValue, formatDate, formatMonth, formatPaise } from '../format'
import type { PaymentListResponse } from '../types'
import { PaymentDetailModal } from '../components/PaymentDetailModal'
import {
  AdminModal,
  EmptyState,
  PageHeader,
  Panel,
  Spinner,
  StatCard,
  StatusBadge,
} from '../components/ui'
import { useToast } from '../components/useToast'

const statusFilters = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
]

export function PaymentsPage() {
  const { notify } = useToast()
  const [month, setMonth] = useState(currentMonthValue())
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<PaymentListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [dueDate, setDueDate] = useState(`${currentMonthValue()}-10`)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        await adminApi.payments.list({
          month,
          status: status || undefined,
          search: search || undefined,
          page,
          limit: 20,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payments')
    } finally {
      setLoading(false)
    }
  }, [month, status, search, page])

  useEffect(() => {
    void load()
  }, [load])

  const runGenerate = async () => {
    setGenerating(true)
    try {
      const summary = await adminApi.payments.generateMonth(month, dueDate)
      notify(
        `${summary.created} bill${summary.created === 1 ? '' : 's'} created · ${summary.existing} already existed`,
        'success',
      )
      setGenerateOpen(false)
      await load()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to generate bills', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Generate monthly dues, record payments and reconcile outstanding balances."
        actions={
          <>
            <a
              href={adminApi.payments.exportUrl({
                month,
                status: status || undefined,
                search: search || undefined,
              })}
              className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => {
                setDueDate(`${month}-10`)
                setGenerateOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generate month
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Billed"
          value={formatPaise(data?.totals.billedPaise ?? 0)}
          hint={`${data?.total ?? 0} bills · ${formatMonth(month)}`}
        />
        <StatCard
          label="Collected"
          value={formatPaise(data?.totals.collectedPaise ?? 0)}
          tone="lime"
        />
        <StatCard
          label="Remaining"
          value={formatPaise(data?.totals.remainingPaise ?? 0)}
          tone="accent"
        />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-1">
            <span className="label-telemetry mb-1.5 block">Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value || currentMonthValue())
                setPage(1)
              }}
              className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            />
          </label>
          <label className="md:col-span-1">
            <span className="label-telemetry mb-1.5 block">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            >
              {statusFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="label-telemetry mb-1.5 block">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
                aria-hidden="true"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, ID or phone"
                className="w-full rounded-md border border-hairline bg-canvas py-2 pl-9 pr-3 font-body text-sm text-white outline-none focus:border-accent"
              />
            </div>
          </label>
        </div>
      </Panel>

      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <Spinner />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
              Loading payments…
            </span>
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {['Member', 'Due', 'Paid', 'Balance', 'Due date', 'Status', ''].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/members/${payment.member}`}
                        className="font-body text-sm text-white hover:text-accent"
                      >
                        {payment.memberName}
                      </Link>
                      <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
                        {payment.memberRef}
                        {payment.phone ? ` · ${payment.phone}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-muted">
                      {formatPaise(payment.dueAmountPaise)}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-lime">
                      {formatPaise(payment.amountPaidPaise)}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-white">
                      {formatPaise(payment.balancePaise)}
                    </td>
                    <td className="px-4 py-3 font-body text-xs text-muted">
                      {formatDate(payment.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPaymentId(payment.id)}
                        className="rounded-md border border-hairline px-3 py-1.5 font-display text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No bills for this month"
            description="Generate monthly dues to create bills for all eligible active members."
          />
        )}
      </Panel>

      {data && data.total > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
            Page {data.page} of {data.pages} · {data.total} bills
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-md border border-hairline px-3 py-2 font-display text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-white disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.page >= data.pages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-hairline px-3 py-2 font-display text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <AdminModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title={`Generate dues · ${formatMonth(month)}`}
        description="Creates one bill per active member (no proration). Existing bills are never overwritten."
      >
        <div className="space-y-4">
          <div>
            <label className="label-telemetry mb-1.5 block">Payment due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerateOpen(false)}
              className="rounded-md border border-hairline px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={runGenerate}
              className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {generating ? <Spinner className="text-canvas" /> : null}
              Generate bills
            </button>
          </div>
        </div>
      </AdminModal>

      <PaymentDetailModal
        paymentId={paymentId}
        onClose={() => setPaymentId(null)}
        onChanged={() => void load()}
      />
    </div>
  )
}
