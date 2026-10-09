import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, MapPin, Pencil, Phone, UserCheck, UserMinus } from 'lucide-react'
import { adminApi } from '../api'
import { formatDate, formatMonth, formatPaise } from '../format'
import type { MemberDetailResponse } from '../types'
import { MemberFormModal } from '../components/MemberFormModal'
import { PaymentDetailModal } from '../components/PaymentDetailModal'
import {
  MemberStatusBadge,
  PageHeader,
  Panel,
  Spinner,
  StatCard,
  StatusBadge,
} from '../components/ui'
import { useToast } from '../components/useToast'

export function MemberDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { notify } = useToast()
  const [data, setData] = useState<MemberDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [paymentId, setPaymentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.members.get(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load member')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const toggleStatus = async () => {
    if (!data) return
    const next = data.member.status === 'active' ? 'inactive' : 'active'
    if (
      !window.confirm(
        next === 'inactive'
          ? `Deactivate ${data.member.fullName}? Their history is preserved.`
          : `Reactivate ${data.member.fullName}?`,
      )
    ) {
      return
    }
    try {
      await adminApi.members.setStatus(data.member.id, next)
      notify(`Member ${next === 'active' ? 'activated' : 'deactivated'}`, 'success')
      await load()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update member', 'error')
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-3 py-20">
        <Spinner />
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
          Loading member…
        </span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
          {error ?? 'Member not found'}
        </p>
        <Link
          to="/admin/members"
          className="inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-accent hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to members
        </Link>
      </div>
    )
  }

  const { member, payments, summary } = data

  return (
    <div className="space-y-6">
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to members
      </Link>

      <PageHeader
        eyebrow={member.memberId}
        title={member.fullName}
        description={member.membershipType ?? undefined}
        actions={
          <>
            <MemberStatusBadge status={member.status} />
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={toggleStatus}
              className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-white"
            >
              {member.status === 'active' ? (
                <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {member.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-1">
          <p className="label-telemetry mb-4">Profile</p>
          <dl className="space-y-3 font-body text-sm">
            <ProfileRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
              {member.phone}
            </ProfileRow>
            <ProfileRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              {member.email ?? '—'}
            </ProfileRow>
            <ProfileRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
              {member.address ?? '—'}
            </ProfileRow>
            <div className="flex justify-between gap-3 border-t border-hairline pt-3">
              <dt className="text-dim">Joined</dt>
              <dd className="text-white">{formatDate(member.joiningDate)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-dim">Monthly fee</dt>
              <dd className="text-white">{formatPaise(member.monthlyFeePaise)}</dd>
            </div>
          </dl>
          {member.notes ? (
            <p className="mt-4 rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-xs text-muted">
              {member.notes}
            </p>
          ) : null}
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total billed" value={formatPaise(summary.totalBilledPaise)} />
            <StatCard
              label="Total paid"
              value={formatPaise(summary.totalPaidPaise)}
              tone="lime"
            />
            <StatCard
              label="Outstanding"
              value={formatPaise(summary.totalOutstandingPaise)}
              tone={summary.totalOutstandingPaise > 0 ? 'danger' : 'default'}
            />
          </div>

          <Panel className="overflow-hidden">
            <div className="border-b border-hairline px-4 py-3">
              <p className="label-telemetry">Payment history</p>
            </div>
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hairline">
                      {['Month', 'Due', 'Paid', 'Balance', 'Status', ''].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-hairline/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-body text-sm text-white">
                          {formatMonth(payment.billingMonth)}
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
              <p className="px-4 py-6 text-center font-body text-sm text-dim">
                No bills generated for this member yet.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <MemberFormModal
        open={formOpen}
        member={member}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <PaymentDetailModal
        paymentId={paymentId}
        onClose={() => setPaymentId(null)}
        onChanged={() => void load()}
      />
    </div>
  )
}

function ProfileRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-2 text-dim">
        {icon}
        {label}
      </dt>
      <dd className="max-w-[60%] break-words text-right text-white">{children}</dd>
    </div>
  )
}
