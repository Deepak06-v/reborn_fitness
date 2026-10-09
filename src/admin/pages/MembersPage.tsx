import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search, UserMinus, UserCheck, Users } from 'lucide-react'
import { adminApi } from '../api'
import { currentMonthValue, formatDate, formatPaise } from '../format'
import type { Member, MemberListResponse } from '../types'
import { MemberFormModal } from '../components/MemberFormModal'
import {
  EmptyState,
  MemberStatusBadge,
  PageHeader,
  Panel,
  Spinner,
  StatusBadge,
} from '../components/ui'
import { useToast } from '../components/useToast'

const statusFilters: { value: string; label: string }[] = [
  { value: '', label: 'All payment states' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
]

const sortOptions: { value: string; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'joining_desc', label: 'Recently joined' },
  { value: 'fee', label: 'Highest fee' },
  { value: 'memberId', label: 'Member ID' },
]

export function MembersPage() {
  const { notify } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [memberStatus, setMemberStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [month, setMonth] = useState(currentMonthValue())
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<MemberListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)

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
        await adminApi.members.list({
          search: search || undefined,
          status: memberStatus || undefined,
          paymentStatus: paymentStatus || undefined,
          month,
          sort,
          page,
          limit: 12,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load members')
    } finally {
      setLoading(false)
    }
  }, [search, memberStatus, paymentStatus, month, sort, page])

  useEffect(() => {
    void load()
  }, [load])

  const toggleStatus = async (member: Member) => {
    const next = member.status === 'active' ? 'inactive' : 'active'
    const confirmed = window.confirm(
      next === 'inactive'
        ? `Deactivate ${member.fullName}? Their history is preserved.`
        : `Reactivate ${member.fullName}?`,
    )
    if (!confirmed) return
    try {
      await adminApi.members.setStatus(member.id, next)
      notify(`Member ${next === 'active' ? 'activated' : 'deactivated'}`, 'success')
      await load()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update member', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Members"
        description="Search, filter and manage every member on the roster."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add member
          </button>
        }
      />

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
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
          <select
            value={memberStatus}
            onChange={(event) => {
              setMemberStatus(event.target.value)
              setPage(1)
            }}
            className="rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
          >
            <option value="">All members</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(event.target.value)
              setPage(1)
            }}
            className="rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
          >
            {statusFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value || currentMonthValue())
                setPage(1)
              }}
              className="rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className="rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none focus:border-accent"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
              Loading members…
            </span>
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {['Member', 'Phone', 'Joined', 'Fee', 'This month', 'Outstanding', 'Status', ''].map(
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
                {data.items.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/members/${member.id}`}
                        className="font-body text-sm text-white hover:text-accent"
                      >
                        {member.fullName}
                      </Link>
                      <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
                        {member.memberId}
                        {member.membershipType ? ` · ${member.membershipType}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {member.phone}
                    </td>
                    <td className="px-4 py-3 font-body text-xs text-muted">
                      {formatDate(member.joiningDate)}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-white">
                      {formatPaise(member.monthlyFeePaise)}
                    </td>
                    <td className="px-4 py-3">
                      {member.currentMonthPayment ? (
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={member.currentMonthPayment.status} />
                          {member.currentMonthPayment.balancePaise > 0 ? (
                            <span className="font-mono text-[0.625rem] text-dim">
                              {formatPaise(member.currentMonthPayment.balancePaise)} due
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-body text-xs text-dim">Not billed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          member.outstandingPaise > 0
                            ? 'font-display text-sm font-bold text-accent'
                            : 'font-display text-sm font-bold text-dim'
                        }
                      >
                        {formatPaise(member.outstandingPaise)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MemberStatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(member)
                            setFormOpen(true)
                          }}
                          aria-label={`Edit ${member.fullName}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(member)}
                          aria-label={
                            member.status === 'active'
                              ? `Deactivate ${member.fullName}`
                              : `Activate ${member.fullName}`
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white"
                        >
                          {member.status === 'active' ? (
                            <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No members found"
            description="Adjust your filters or add a new member to get started."
          />
        )}
      </Panel>

      {data && data.total > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
            Page {data.page} of {data.pages} · {data.total} members
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

      <MemberFormModal
        open={formOpen}
        member={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}
