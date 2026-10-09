import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { adminApi } from '../api'
import {
  currentMonthValue,
  formatDate,
  formatMonth,
  formatMonthShort,
  formatPaise,
} from '../format'
import type { DashboardResponse, PaymentStatus } from '../types'
import {
  EmptyState,
  PageHeader,
  Panel,
  Spinner,
  StatCard,
  StatusBadge,
} from '../components/ui'

export function AdminDashboard() {
  const [month, setMonth] = useState(currentMonthValue())
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.dashboard(month))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  const metrics = data?.metrics
  const trendMax = Math.max(
    1,
    ...(data?.monthlyTrend.flatMap((point) => [point.expectedPaise, point.collectedPaise]) ??
      []),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live membership, billing and collection health for the selected month."
        actions={
          <label className="flex items-center gap-2">
            <span className="label-telemetry">Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || currentMonthValue())}
              className="rounded-md border border-hairline bg-surface px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            />
          </label>
        }
      />

      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 py-20">
          <Spinner />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
            Loading dashboard…
          </span>
        </div>
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Collections this month"
              value={formatPaise(metrics.collectionsThisMonthPaise)}
              hint={`${metrics.collectionsCount} payments received`}
              tone="lime"
              icon={<Banknote className="h-4 w-4" />}
            />
            <StatCard
              label="Expected this month"
              value={formatPaise(metrics.expectedMonthlyFeesPaise)}
              hint={`${metrics.expectedCount} bills raised`}
              icon={<Receipt className="h-4 w-4" />}
            />
            <StatCard
              label="Outstanding this month"
              value={formatPaise(metrics.outstandingPaymentsPaise)}
              hint={`${metrics.outstandingCount} unpaid bills`}
              tone="accent"
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              label="Overdue (all months)"
              value={formatPaise(metrics.overduePaymentsPaise)}
              hint={`${metrics.overdueCount} bills past due`}
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Active members"
              value={metrics.totalActiveMembers}
              hint={`${metrics.newMembersThisMonth} joined this month`}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="New members this month"
              value={metrics.newMembersThisMonth}
              hint={formatMonth(month)}
              icon={<UserPlus className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3">
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                <p className="label-telemetry">Six-month trend</p>
                <span className="flex items-center gap-4 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-accent" /> Expected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-lime" /> Collected
                  </span>
                </span>
              </div>
              <div className="flex items-end justify-between gap-3 px-5 py-6">
                {data?.monthlyTrend.map((point) => (
                  <div key={point.month} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end justify-center gap-1">
                      <div
                        className="w-1/2 rounded-t bg-accent/70"
                        style={{
                          height: `${Math.max(
                            (point.expectedPaise / trendMax) * 100,
                            point.expectedPaise > 0 ? 4 : 0,
                          )}%`,
                        }}
                        title={`Expected ${formatPaise(point.expectedPaise)}`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-lime/80"
                        style={{
                          height: `${Math.max(
                            (point.collectedPaise / trendMax) * 100,
                            point.collectedPaise > 0 ? 4 : 0,
                          )}%`,
                        }}
                        title={`Collected ${formatPaise(point.collectedPaise)}`}
                      />
                    </div>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
                      {formatMonthShort(point.month)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="lg:col-span-2">
              <div className="border-b border-hairline px-5 py-4">
                <p className="label-telemetry">Status breakdown · {formatMonth(month)}</p>
              </div>
              <div className="space-y-3 px-5 py-5">
                {(['paid', 'partial', 'unpaid', 'overdue'] as PaymentStatus[]).map(
                  (status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between gap-3"
                    >
                      <StatusBadge status={status} />
                      <span className="font-display text-lg font-bold text-white">
                        {data?.statusOverview[status] ?? 0}
                      </span>
                    </div>
                  ),
                )}
                <Link
                  to="/admin/payments"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-accent transition-colors hover:text-white"
                >
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Open payments
                </Link>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <div className="border-b border-hairline px-5 py-4">
                <p className="label-telemetry">Recent payments</p>
              </div>
              {data && data.recentPayments.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {data.recentPayments.map((payment) => (
                    <li
                      key={`${payment.paymentId}-${payment.paymentDate}`}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm text-white">
                          {payment.memberName}{' '}
                          <span className="font-mono text-[0.6875rem] text-dim">
                            {payment.memberId}
                          </span>
                        </p>
                        <p className="font-mono text-[0.6875rem] text-dim">
                          {formatDate(payment.paymentDate)} ·{' '}
                          <span className="capitalize">{payment.method.replace('_', ' ')}</span>
                        </p>
                      </div>
                      <span className="font-display text-sm font-bold text-lime">
                        +{formatPaise(payment.amountPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No payments yet" description="Recorded payments appear here." />
              )}
            </Panel>

            <Panel>
              <div className="border-b border-hairline px-5 py-4">
                <p className="label-telemetry">Overdue members</p>
              </div>
              {data && data.overdueMembers.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {data.overdueMembers.map((member) => (
                    <li key={member.id} className="px-5 py-3">
                      <Link
                        to={`/admin/members/${member.id}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm text-white hover:text-accent">
                            {member.fullName}{' '}
                            <span className="font-mono text-[0.6875rem] text-dim">
                              {member.memberId}
                            </span>
                          </p>
                          <p className="font-mono text-[0.6875rem] text-dim">
                            {member.months} bill{member.months > 1 ? 's' : ''} · oldest{' '}
                            {formatDate(member.oldestDue)}
                          </p>
                        </div>
                        <span className="font-display text-sm font-bold text-red-400">
                          {formatPaise(member.balancePaise)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="All caught up"
                  description="No overdue balances for this period."
                />
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  )
}
