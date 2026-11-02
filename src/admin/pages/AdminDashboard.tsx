import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { adminApi } from '../api'
import { cn } from '../../lib/utils'
import {
  currentMonthValue,
  formatDate,
  formatMonth,
  formatMonthShort,
  formatPaise,
} from '../format'
import type { BulkRecordResponse, DashboardResponse, PaymentFollowUpItem, PaymentStatus } from '../types'
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

export function AdminDashboard() {
  const { notify } = useToast()
  const [month, setMonth] = useState(currentMonthValue())
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'due_today'>('all')
  const [page, setPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null)
  const [summaryModal, setSummaryModal] = useState<BulkRecordResponse | null>(null)
  const pageSize = 10

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

  // Unified follow-up items: overdue + due-today
  const followUpItems: PaymentFollowUpItem[] = useMemo(() => {
    if (data?.paymentFollowUp && data.paymentFollowUp.length > 0) {
      return data.paymentFollowUp
    }
    const list: PaymentFollowUpItem[] = []
    if (data?.overdueMembers) {
      for (const m of data.overdueMembers) {
        list.push({
          id: m.id,
          memberId: m.memberId,
          fullName: m.fullName,
          phone: m.phone,
          planName: (m as PaymentFollowUpItem).planName ?? 'Membership',
          balancePaise: m.balancePaise,
          balance: m.balance,
          months: m.months,
          oldestDue: m.oldestDue,
          dueDate: (m as PaymentFollowUpItem).dueDate ?? m.oldestDue,
          paymentId: (m as PaymentFollowUpItem).paymentId ?? m.id,
          status: (m as PaymentFollowUpItem).status ?? 'overdue',
          statusLabel: (m as PaymentFollowUpItem).statusLabel ?? 'Overdue',
        })
      }
    }
    if (data?.dueTodayMembers) {
      for (const m of data.dueTodayMembers) {
        if (!list.some((existing) => existing.id === m.id)) {
          list.push(m)
        }
      }
    }
    return list
  }, [data])

  const overdueCount =
    data?.followUpCounts?.overdue ??
    followUpItems.filter((i) => i.status === 'overdue').length
  const dueTodayCount =
    data?.followUpCounts?.dueToday ??
    followUpItems.filter((i) => i.status === 'due_today').length
  const totalFollowUpCount = followUpItems.length

  const filteredItems = useMemo(() => {
    if (filterTab === 'overdue') return followUpItems.filter((i) => i.status === 'overdue')
    if (filterTab === 'due_today') return followUpItems.filter((i) => i.status === 'due_today')
    return followUpItems
  }, [followUpItems, filterTab])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  const allVisibleSelected =
    paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        paginatedItems.forEach((item) => next.delete(item.id))
      } else {
        paginatedItems.forEach((item) => next.add(item.id))
      }
      return next
    })
  }

  const selectedMembersList = useMemo(
    () => followUpItems.filter((i) => selectedIds.has(i.id)),
    [followUpItems, selectedIds],
  )
  const totalSelectedBills = useMemo(
    () => selectedMembersList.reduce((acc, m) => acc + (m.months || 1), 0),
    [selectedMembersList],
  )
  const totalSelectedPaise = useMemo(
    () => selectedMembersList.reduce((acc, m) => acc + m.balancePaise, 0),
    [selectedMembersList],
  )

  const handleOpenConfirm = () => {
    if (selectedIds.size === 0) return
    if (!currentOperationId) {
      setCurrentOperationId(`bulk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
    }
    setConfirmModalOpen(true)
  }

  const handleExecuteBulkPayment = async () => {
    if (selectedIds.size === 0 || submitting) return
    setSubmitting(true)
    const opId = currentOperationId || `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    if (!currentOperationId) setCurrentOperationId(opId)

    try {
      const response = await adminApi.payments.bulkRecord({
        memberIds: Array.from(selectedIds),
        operationId: opId,
      })

      setConfirmModalOpen(false)

      if (response.failedCount === 0) {
        notify(
          `${response.successfulCount} ${response.successfulCount === 1 ? 'member' : 'members'} (${formatPaise(response.totalAmountPaise ?? totalSelectedPaise)}) recorded successfully`,
          'success',
        )
        setSelectedIds(new Set())
        setCurrentOperationId(null)
      } else {
        const successfulIds = new Set(
          response.results.filter((r) => r.success).map((r) => r.memberId),
        )
        setSelectedIds((prev) => new Set([...prev].filter((id) => !successfulIds.has(id))))

        if (response.successfulCount > 0) {
          notify(
            `${response.successfulCount} recorded, ${response.failedCount} failed`,
            'info',
          )
        } else {
          notify(`All ${response.failedCount} payments failed`, 'error')
        }
        setSummaryModal(response)
      }

      await load()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to record payments', 'error')
    } finally {
      setSubmitting(false)
    }
  }

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

          {/* Payment Follow-up Section with Bulk Actions */}
          <Panel>
            <div className="flex flex-col gap-3 border-b border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <p className="label-telemetry">Payment follow-up</p>
                  <span className="font-mono text-xs text-dim">
                    Overdue:{' '}
                    <strong className="font-bold text-red-400">{overdueCount}</strong>
                    {' · '}Due Today:{' '}
                    <strong className="font-bold text-accent">{dueTodayCount}</strong>
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTab('all')
                      setPage(1)
                    }}
                    className={cn(
                      'rounded px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors',
                      filterTab === 'all'
                        ? 'border border-accent/40 bg-accent/20 text-accent'
                        : 'border border-transparent text-dim hover:text-white',
                    )}
                  >
                    All ({totalFollowUpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTab('overdue')
                      setPage(1)
                    }}
                    className={cn(
                      'rounded px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors',
                      filterTab === 'overdue'
                        ? 'border border-red-500/40 bg-red-500/20 text-red-300'
                        : 'border border-transparent text-dim hover:text-white',
                    )}
                  >
                    Overdue ({overdueCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTab('due_today')
                      setPage(1)
                    }}
                    className={cn(
                      'rounded px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors',
                      filterTab === 'due_today'
                        ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
                        : 'border border-transparent text-dim hover:text-white',
                    )}
                  >
                    Due Today ({dueTodayCount})
                  </button>
                </div>
              </div>

              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                    {selectedIds.size} {selectedIds.size === 1 ? 'member' : 'members'} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenConfirm}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-canvas transition-colors hover:bg-accent/90 disabled:opacity-60"
                  >
                    {submitting ? (
                      <Spinner className="h-3.5 w-3.5 text-canvas" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Save Changes
                  </button>
                </div>
              ) : null}
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState
                title="All caught up"
                description={
                  filterTab === 'overdue'
                    ? 'No overdue balances found.'
                    : filterTab === 'due_today'
                      ? 'No payments due today.'
                      : 'No overdue or due-today payments.'
                }
              />
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-hairline bg-surface/50 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-dim">
                        <th className="w-12 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all members on this page"
                            className="h-4 w-4 cursor-pointer rounded border-hairline bg-canvas accent-[#FFEE00]"
                          />
                        </th>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Amount Due</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {paginatedItems.map((item) => {
                        const isSelected = selectedIds.has(item.id)
                        const isOverdue = item.status === 'overdue'
                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              'transition-colors hover:bg-white/[0.02]',
                              isSelected && 'bg-accent/10 hover:bg-accent/15',
                            )}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(item.id)}
                                aria-label={`Select ${item.fullName}`}
                                className="h-4 w-4 cursor-pointer rounded border-hairline bg-canvas accent-[#FFEE00]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/admin/members/${item.id}`}
                                className="font-body text-sm font-medium text-white transition-colors hover:text-accent"
                              >
                                {item.fullName}
                              </Link>
                              <p className="font-mono text-[0.6875rem] text-dim">{item.memberId}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted">
                              {item.phone ? (
                                <a
                                  href={`tel:${item.phone}`}
                                  className="transition-colors hover:text-white"
                                >
                                  {item.phone}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3 font-body text-xs text-dim">
                              {item.planName}
                              {item.months > 1 ? (
                                <span className="ml-1 text-dim/80">({item.months} bills)</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-display text-sm font-bold text-red-400">
                              {formatPaise(item.balancePaise)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-dim">
                              {formatDate(item.dueDate)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isOverdue ? (
                                <span className="inline-block rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-wider text-red-300">
                                  Overdue
                                </span>
                              ) : (
                                <span className="inline-block rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-wider text-amber-300">
                                  Due Today
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="divide-y divide-hairline sm:hidden">
                  {paginatedItems.map((item) => {
                    const isSelected = selectedIds.has(item.id)
                    const isOverdue = item.status === 'overdue'
                    return (
                      <div
                        key={item.id}
                        className={cn('p-4 transition-colors', isSelected && 'bg-accent/10')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="mt-1 h-4 w-4 cursor-pointer rounded border-hairline bg-canvas accent-[#FFEE00]"
                            />
                            <div>
                              <Link
                                to={`/admin/members/${item.id}`}
                                className="font-body text-sm font-medium text-white hover:text-accent"
                              >
                                {item.fullName}
                              </Link>
                              <p className="font-mono text-[0.6875rem] text-dim">
                                {item.memberId} · {item.phone || 'No phone'}
                              </p>
                              <p className="mt-1 font-body text-xs text-dim">
                                {item.planName} · Due {formatDate(item.dueDate)}
                              </p>
                            </div>
                          </label>
                          <div className="text-right">
                            <p className="font-display text-sm font-bold text-red-400">
                              {formatPaise(item.balancePaise)}
                            </p>
                            <span
                              className={cn(
                                'mt-1 inline-block rounded px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-wider',
                                isOverdue
                                  ? 'border border-red-500/40 bg-red-500/10 text-red-300'
                                  : 'border border-amber-500/40 bg-amber-500/10 text-amber-300',
                              )}
                            >
                              {item.statusLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination & Status Footer */}
                <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline px-5 py-3 sm:flex-row">
                  <p className="font-mono text-xs text-dim">
                    Showing {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length}{' '}
                    members
                    {selectedIds.size > 0 ? (
                      <span className="text-accent">
                        {' '}
                        ({selectedIds.size} selected across all pages)
                      </span>
                    ) : null}
                  </p>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="inline-flex items-center gap-1 rounded border border-hairline px-2.5 py-1 font-mono text-xs text-dim transition-colors hover:text-white disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>
                      <span className="font-mono text-xs text-dim">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="inline-flex items-center gap-1 rounded border border-hairline px-2.5 py-1 font-mono text-xs text-dim transition-colors hover:text-white disabled:opacity-40"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Panel>

          {/* Recent Payments Section */}
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

          {/* Bulk Payment Confirmation Modal */}
          <AdminModal
            open={confirmModalOpen}
            onClose={() => !submitting && setConfirmModalOpen(false)}
            title="Confirm Bulk Payment Recording"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded border border-hairline bg-canvas p-3 sm:grid-cols-4">
                <div>
                  <p className="font-mono text-[0.625rem] uppercase text-dim">Members Selected</p>
                  <p className="font-display text-base font-bold text-white">
                    {selectedMembersList.length}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.625rem] uppercase text-dim">Bills to Settle</p>
                  <p className="font-display text-base font-bold text-accent">
                    {totalSelectedBills}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.625rem] uppercase text-dim">Payment Method</p>
                  <p className="font-display text-base font-bold text-white">Cash</p>
                </div>
                <div>
                  <p className="font-mono text-[0.625rem] uppercase text-dim">Total Amount</p>
                  <p className="font-display text-base font-bold text-lime">
                    {formatPaise(totalSelectedPaise)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wider text-dim">
                  Selected Member Breakdown
                </p>
                <div className="max-h-60 overflow-y-auto divide-y divide-hairline rounded border border-hairline bg-canvas">
                  {selectedMembersList.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <p className="font-medium text-white">{m.fullName}</p>
                        <p className="font-mono text-[0.6875rem] text-dim">
                          {m.memberId} · {m.planName} ({m.months || 1} {m.months === 1 ? 'bill' : 'bills'})
                        </p>
                      </div>
                      <span className="font-display font-bold text-red-400">
                        {formatPaise(m.balancePaise)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  disabled={submitting}
                  className="rounded border border-hairline px-4 py-2 font-mono text-xs uppercase tracking-wider text-dim hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkPayment}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-canvas hover:bg-accent/90 disabled:opacity-60"
                >
                  {submitting ? (
                    <Spinner className="h-3.5 w-3.5 text-canvas" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Confirm &amp; Record Payments
                </button>
              </div>
            </div>
          </AdminModal>

          {/* Bulk Payment Result Summary Modal */}
          {summaryModal ? (
            <AdminModal
              open={Boolean(summaryModal)}
              onClose={() => setSummaryModal(null)}
              title="Payment update completed"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded border border-hairline bg-canvas p-3 text-center">
                  <div>
                    <p className="font-mono text-[0.625rem] uppercase text-dim">Selected</p>
                    <p className="font-display text-lg font-bold text-white">
                      {summaryModal.total}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[0.625rem] uppercase text-dim">Recorded</p>
                    <p className="font-display text-lg font-bold text-lime">
                      {summaryModal.successfulCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[0.625rem] uppercase text-dim">Failed</p>
                    <p className="font-display text-lg font-bold text-red-400">
                      {summaryModal.failedCount}
                    </p>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-hairline rounded border border-hairline bg-canvas">
                  {summaryModal.memberResults && summaryModal.memberResults.length > 0
                    ? summaryModal.memberResults.map((m) => {
                        const firstError = m.records.find((r) => r.error)?.error
                        return (
                          <div key={m.memberId} className="flex items-center justify-between p-3 text-xs">
                            <div>
                              <p className="font-medium text-white">
                                {m.memberName || m.memberRef || m.memberId}
                              </p>
                              {m.success ? (
                                <p className="text-dim">
                                  {m.processedRecords}/{m.totalRecords} bills settled ·{' '}
                                  {formatPaise(m.totalAmountPaise)}
                                </p>
                              ) : (
                                <p className="text-red-300">
                                  {firstError || `${m.processedRecords}/${m.totalRecords} bills settled`}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase',
                                m.success ? 'bg-lime/10 text-lime' : 'bg-red-500/10 text-red-300',
                              )}
                            >
                              {m.success ? 'Success' : 'Failed'}
                            </span>
                          </div>
                        )
                      })
                    : summaryModal.results.map((res) => (
                        <div key={res.memberId} className="flex items-center justify-between p-3 text-xs">
                          <div>
                            <p className="font-medium text-white">
                              {res.memberName ?? res.memberRef ?? res.memberId}
                            </p>
                            {res.error ? (
                              <p className="text-red-300">{res.error}</p>
                            ) : (
                              <p className="text-dim">
                                {res.invoiceNumber ?? 'Payment recorded'} ·{' '}
                                {formatPaise(res.amountPaise ?? 0)}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase',
                              res.success ? 'bg-lime/10 text-lime' : 'bg-red-500/10 text-red-300',
                            )}
                          >
                            {res.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {summaryModal.failedCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleExecuteBulkPayment}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-accent hover:bg-accent/20 disabled:opacity-50"
                    >
                      {submitting ? <Spinner className="h-3 w-3" /> : null}
                      Retry Unfinished Items
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSummaryModal(null)}
                    className="rounded bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-canvas hover:bg-accent/90"
                  >
                    Close
                  </button>
                </div>
              </div>
            </AdminModal>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
