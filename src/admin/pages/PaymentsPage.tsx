import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Receipt, Search } from 'lucide-react'
import { adminApi } from '../api'
import { formatDate, formatMonth, formatPaise } from '../format'
import type { PaymentListResponse } from '../types'
import { PaymentDetailModal } from '../components/PaymentDetailModal'
import {
  DueBadge,
  EmptyState,
  PageHeader,
  Panel,
  Spinner,
  StatCard,
} from '../components/ui'

const statusFilters = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'overdue', label: 'Overdue' },
]

export function PaymentsPage() {
  // Empty month = every billing period (the combined view).
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<PaymentListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Billing periods are created automatically from each member's joining date and plan. Record payments and track outstanding balances."
        actions={
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
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Billed"
          value={formatPaise(data?.totals.billedPaise ?? 0)}
          hint={`${data?.total ?? 0} bills${month ? ` · ${formatMonth(month)}` : ' · all periods'}`}
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
          <div className="md:col-span-1">
            <span className="label-telemetry mb-1.5 block">Month</span>
            <div className="flex gap-2">
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
              />
              {month ? (
                <button
                  type="button"
                  onClick={() => {
                    setMonth('')
                    setPage(1)
                  }}
                  className="shrink-0 rounded-md border border-hairline px-3 py-2 font-display text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
                >
                  All
                </button>
              ) : null}
            </div>
          </div>
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
                      {payment.invoiceNumber ? (
                        <p className="font-mono text-[0.625rem] text-dim">
                          {payment.invoiceNumber}
                          {payment.planName ? ` · ${payment.planName}` : ''}
                        </p>
                      ) : null}
                      {payment.periodStart ? (
                        <p className="font-mono text-[0.625rem] text-dim">
                          {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
                        </p>
                      ) : null}
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
                      <DueBadge state={payment.dueState} />
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
            title="No bills found"
            description="Billing periods are created automatically from each member's joining date and plan."
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

      <PaymentDetailModal
        paymentId={paymentId}
        onClose={() => setPaymentId(null)}
        onChanged={() => void load()}
      />
    </div>
  )
}
