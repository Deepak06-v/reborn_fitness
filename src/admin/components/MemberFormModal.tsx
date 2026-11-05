import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { plans } from '../../data/plans'
import { cn } from '../../lib/utils'
import { adminApi, ApiError } from '../api'
import {
  calculateMembershipEndDate,
  formatINR,
  isValidPhone,
  normalizePhone,
  todayInputValue,
} from '../format'
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

const planDurationMonthsMap: Record<string, number> = {
  monthly: 1,
  'monthly-1500': 1,
  'monthly-2000': 1,
  '15days-500': 0,
  'two-months': 2,
  'three-months': 3,
  'four-months': 4,
  '4months-5000': 4,
  'five-months': 5,
  'six-months': 6,
  'seven-months': 7,
  'eight-months': 8,
  'nine-months': 9,
  'ten-months': 10,
  'eleven-months': 11,
  yearly: 12,
  'thirteen-months': 13,
  'fourteen-months': 14,
  'fifteen-months': 15,
  'pt-3-months': 3,
  'pt-6-months': 6,
}

const planDurationDaysMap: Record<string, number> = {
  '15days-500': 15,
}

interface DuplicateMemberInfo {
  memberId: string
  fullName: string
  status: 'active' | 'inactive'
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
  const [planId, setPlanId] = useState('')
  const [joiningDate, setJoiningDate] = useState(todayInputValue())
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Duplicate phone state
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateMemberInfo | null>(null)
  const [phoneChecking, setPhoneChecking] = useState(false)
  const [phoneCheckError, setPhoneCheckError] = useState<string | null>(null)
  const [checkedPhone, setCheckedPhone] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    setDuplicateInfo(null)
    setPhoneChecking(false)
    setPhoneCheckError(null)

    if (member) {
      setFullName(member.fullName)
      setPhone(member.phone)
      setEmail(member.email ?? '')
      setMembershipType(member.membershipType ?? '')
      setPlanId(member.planId ?? '')
      setJoiningDate(member.joiningDate.slice(0, 10))
      setAddress(member.address ?? '')
      setNotes(member.notes ?? '')
      setCheckedPhone(normalizePhone(member.phone))
    } else {
      setFullName('')
      setPhone('')
      setEmail('')
      setMembershipType('')
      setPlanId('')
      setJoiningDate(todayInputValue())
      setAddress('')
      setNotes('')
      setCheckedPhone('')
    }
  }, [open, member])

  // Debounced phone availability check
  useEffect(() => {
    if (!open) return

    const canonical = normalizePhone(phone)

    // Clear duplicate warning immediately if phone is modified
    if (canonical !== checkedPhone && duplicateInfo) {
      setDuplicateInfo(null)
    }

    if (!isValidPhone(canonical)) {
      setDuplicateInfo(null)
      setPhoneChecking(false)
      setPhoneCheckError(null)
      return
    }

    // If editing and phone matches this member's current phone, it's valid without conflict
    if (member && canonical === normalizePhone(member.phone)) {
      setDuplicateInfo(null)
      setPhoneChecking(false)
      setPhoneCheckError(null)
      setCheckedPhone(canonical)
      return
    }

    let active = true
    setPhoneChecking(true)
    setPhoneCheckError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await adminApi.members.checkPhone(canonical, member?.id)
        if (!active) return

        setCheckedPhone(canonical)
        if (res.exists && res.member) {
          setDuplicateInfo({
            memberId: res.member.memberId,
            fullName: res.member.fullName,
            status: res.member.status,
          })
        } else {
          setDuplicateInfo(null)
        }
      } catch (err) {
        if (!active) return
        setPhoneCheckError('Unable to check phone availability. Backend verification remains active.')
      } finally {
        if (active) {
          setPhoneChecking(false)
        }
      }
    }, 400)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [phone, open, member, checkedPhone, duplicateInfo])

  const onPhoneBlur = async () => {
    const canonical = normalizePhone(phone)
    if (!isValidPhone(canonical)) return
    if (member && canonical === normalizePhone(member.phone)) return
    if (canonical === checkedPhone && !phoneChecking) return

    setPhoneChecking(true)
    setPhoneCheckError(null)
    try {
      const res = await adminApi.members.checkPhone(canonical, member?.id)
      setCheckedPhone(canonical)
      if (res.exists && res.member) {
        setDuplicateInfo({
          memberId: res.member.memberId,
          fullName: res.member.fullName,
          status: res.member.status,
        })
      } else {
        setDuplicateInfo(null)
      }
    } catch {
      setPhoneCheckError('Unable to check phone availability. Backend verification remains active.')
    } finally {
      setPhoneChecking(false)
    }
  }

  const canonicalPhone = normalizePhone(phone)
  const isPhoneValid = isValidPhone(canonicalPhone)
  const isOwnPhone = member ? canonicalPhone === normalizePhone(member.phone) : false
  const isPhoneAvailable = isPhoneValid && !isOwnPhone && checkedPhone === canonicalPhone && !duplicateInfo

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null
  const selectedDurationMonths = selectedPlan ? (planDurationMonthsMap[selectedPlan.id] ?? 1) : 0
  const selectedDurationDays = selectedPlan ? (planDurationDaysMap[selectedPlan.id] ?? 0) : 0
  const calculatedEndDate =
    selectedPlan && joiningDate
      ? calculateMembershipEndDate(joiningDate, selectedDurationMonths, selectedDurationDays)
      : null

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || phoneChecking) return
    setError(null)

    if (!member && !planId) {
      setError('Select a membership plan')
      return
    }

    const canonical = normalizePhone(phone)
    if (!isValidPhone(canonical)) {
      setError('Phone number must contain exactly 10 digits')
      return
    }

    if (duplicateInfo) {
      setError('A member with this phone number already exists.')
      return
    }

    setSubmitting(true)
    const payload: Record<string, unknown> = {
      fullName: fullName.trim(),
      phone: canonical,
      email: email.trim() || null,
      membershipType: membershipType.trim() || null,
      joiningDate,
      address: address.trim() || null,
      notes: notes.trim() || null,
    }
    // The server derives the fee from the plan; only an explicit, non-empty
    // selection is sent (blank preserves a legacy member's plan on edit).
    if (planId) payload.planId = planId

    try {
      const saved = member
        ? await adminApi.members.update(member.id, payload)
        : await adminApi.members.create(payload)
      notify(member ? 'Member updated' : 'Member created', 'success')
      onSaved(saved)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.code === 'duplicate_member' || err.status === 409)) {
        const details = err.details as DuplicateMemberInfo | undefined
        if (details?.memberId && details?.fullName) {
          setDuplicateInfo({
            memberId: details.memberId,
            fullName: details.fullName,
            status: details.status || 'active',
          })
        }
        setError(err.message || 'A member with this phone number already exists.')
      } else {
        setError(err instanceof Error ? err.message : 'Unable to save member')
      }
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
            <div className="relative">
              <input
                required
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value)
                  if (error) setError(null)
                }}
                onBlur={onPhoneBlur}
                placeholder="98765 43210 or +91 98765 43210"
                className={cn(
                  inputClass,
                  duplicateInfo && 'border-red-500 focus:border-red-500',
                  !duplicateInfo && !phoneChecking && isPhoneAvailable && 'border-lime/60 focus:border-lime',
                )}
              />
              {phoneChecking ? (
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Spinner className="h-4 w-4 text-accent" />
                </div>
              ) : null}
            </div>

            {/* Duplicate Member Warning Banner */}
            {duplicateInfo ? (
              <div className="mt-2 rounded-md border border-red-500/50 bg-red-950/40 p-3 text-xs text-red-200">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Member already exists!</span>
                </div>
                <p className="mt-1 text-white/90">
                  A member with this phone number is already registered.
                </p>
                <div className="mt-2 space-y-0.5 rounded border border-white/10 bg-black/40 p-2 font-mono text-[0.6875rem]">
                  <p>
                    <span className="text-dim">Member:</span>{' '}
                    <span className="font-semibold text-white">{duplicateInfo.fullName}</span>
                  </p>
                  <p>
                    <span className="text-dim">Member ID:</span>{' '}
                    <span className="font-semibold text-accent">{duplicateInfo.memberId}</span>
                  </p>
                  <p>
                    <span className="text-dim">Membership status:</span>{' '}
                    <span
                      className={cn(
                        'font-semibold capitalize',
                        duplicateInfo.status === 'active' ? 'text-lime' : 'text-amber-400',
                      )}
                    >
                      {duplicateInfo.status}
                    </span>
                  </p>
                </div>
                <p className="mt-2 font-semibold text-red-300">
                  {duplicateInfo.status === 'inactive'
                    ? 'This phone number belongs to an existing inactive record. Please use the existing member-management workflow (activate the member) rather than registering a new member.'
                    : 'This member cannot be added again.'}
                </p>
              </div>
            ) : null}

            {phoneChecking ? (
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[0.6875rem] text-accent">
                <Spinner className="h-3 w-3 text-accent" />
                <span>Checking phone availability…</span>
              </p>
            ) : null}

            {phoneCheckError ? (
              <p className="mt-1 font-mono text-[0.6875rem] text-amber-400">
                {phoneCheckError}
              </p>
            ) : null}

            {!duplicateInfo && !phoneChecking && isPhoneAvailable ? (
              <p className="mt-1 flex items-center gap-1 font-mono text-[0.6875rem] text-lime">
                <Check className="h-3 w-3" />
                <span>Phone number available</span>
              </p>
            ) : null}
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
            <label className="label-telemetry mb-1.5 block">Membership plan</label>
            <select
              required={!member}
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select a plan
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {formatINR(plan.offerPrice)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim">
              {selectedPlan
                ? `${selectedPlan.duration} · ${formatINR(selectedPlan.offerPrice)}`
                : 'Price and duration come from the selected plan'}
            </p>
            {calculatedEndDate ? (
              <p className="mt-1 font-mono text-xs text-accent">
                Membership valid until:{' '}
                <span className="font-semibold text-white">{calculatedEndDate}</span>
              </p>
            ) : null}
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
            disabled={submitting || phoneChecking || Boolean(duplicateInfo)}
            className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Spinner className="text-canvas" /> : null}
            {member ? 'Save changes' : 'Create member'}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}
