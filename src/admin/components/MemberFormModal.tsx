import { useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '../api'
import { paiseToRupeeInput, rupeesToPaise, todayInputValue } from '../format'
import type { Member } from '../types'
import { AdminModal, Spinner } from './ui'
import { useToast } from './useToast'

const inputClass =
  'w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white outline-none transition-colors focus:border-accent'

interface MemberFormModalProps {
  open: boolean
  member: Member | null
  onClose: () => void
  onSaved: (member: Member) => void
}

export function MemberFormModal({
  open,
  member,
  onClose,
  onSaved,
}: MemberFormModalProps) {
  const { notify } = useToast()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [membershipType, setMembershipType] = useState('')
  const [joiningDate, setJoiningDate] = useState(todayInputValue())
  const [monthlyFee, setMonthlyFee] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (member) {
      setFullName(member.fullName)
      setPhone(member.phone)
      setEmail(member.email ?? '')
      setMembershipType(member.membershipType ?? '')
      setJoiningDate(member.joiningDate.slice(0, 10))
      setMonthlyFee(paiseToRupeeInput(member.monthlyFeePaise))
      setAddress(member.address ?? '')
      setNotes(member.notes ?? '')
    } else {
      setFullName('')
      setPhone('')
      setEmail('')
      setMembershipType('')
      setJoiningDate(todayInputValue())
      setMonthlyFee('')
      setAddress('')
      setNotes('')
    }
  }, [open, member])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      membershipType: membershipType.trim() || null,
      joiningDate,
      monthlyFeePaise: rupeesToPaise(monthlyFee),
      address: address.trim() || null,
      notes: notes.trim() || null,
    }
    try {
      const saved = member
        ? await adminApi.members.update(member.id, payload)
        : await adminApi.members.create(payload)
      notify(member ? 'Member updated' : 'Member created', 'success')
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save member')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      size="lg"
      title={member ? 'Edit member' : 'Add member'}
      description={
        member
          ? `${member.memberId} · joined ${member.joiningDate.slice(0, 10)}`
          : 'Create a new member record. A member ID is generated automatically.'
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-telemetry mb-1.5 block">Full name</label>
            <input
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-telemetry mb-1.5 block">Phone</label>
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-telemetry mb-1.5 block">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-telemetry mb-1.5 block">Joining date</label>
            <input
              type="date"
              required
              value={joiningDate}
              onChange={(event) => setJoiningDate(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-telemetry mb-1.5 block">Monthly fee (₹)</label>
            <input
              required
              inputMode="decimal"
              value={monthlyFee}
              onChange={(event) => setMonthlyFee(event.target.value)}
              placeholder="1500"
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-telemetry mb-1.5 block">Membership type (optional)</label>
            <input
              value={membershipType}
              onChange={(event) => setMembershipType(event.target.value)}
              placeholder="Strength / Cardio / Elite"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="label-telemetry mb-1.5 block">Address (optional)</label>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="label-telemetry mb-1.5 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? <Spinner className="text-canvas" /> : null}
            {member ? 'Save changes' : 'Create member'}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}
