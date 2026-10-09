import { useRef, useState, type FormEvent } from 'react'
import html2canvas from 'html2canvas'
import {
  Check,
  ChevronRight,
  Crosshair,
  Dumbbell,
  HeartPulse,
  RotateCcw,
  Sparkles,
  Waves,
} from 'lucide-react'
import { daySlots, goals } from '../../data/booking'
import { coaches } from '../../data/coaches'
import { brand } from '../../data/site'
import { cn } from '../../lib/utils'
import type { BookingSelection, IssuedPass } from '../../types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

const goalIcons: Record<string, typeof Dumbbell> = {
  strength: Dumbbell,
  conditioning: HeartPulse,
  hypertrophy: Sparkles,
  recovery: Waves,
}

function todayAndTomorrow() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  return [
    { id: 'today', label: 'Today', detail: fmt.format(today) },
    { id: 'tomorrow', label: 'Tomorrow', detail: fmt.format(tomorrow) },
  ]
}

const days = todayAndTomorrow()

function pad(value: number, length = 4) {
  return value.toString().padStart(length, '0')
}

function issuePass(selection: BookingSelection): IssuedPass {
  const stamp = Date.now()
  return {
    bookingRef: `RB-${stamp.toString(36).toUpperCase().slice(-6)}`,
    entryCode: pad(((stamp / 1000) | 0) % 10000),
    issuedAt: new Date(),
    dayLabel: days.find((d) => d.id === selection.dayId)?.label ?? 'Today',
    slotLabel:
      daySlots.find((s) => s.id === selection.slotId)?.label ?? 'Morning',
    goalLabel: goals.find((g) => g.id === selection.goalId)?.label ?? 'Strength',
    guestName: selection.name.trim(),
    coachName: selection.coachId
      ? (coaches.find((c) => c.id === selection.coachId)?.name ?? null)
      : null,
  }
}

const initialSelection: BookingSelection = {
  goalId: 'strength',
  dayId: 'today',
  slotId: 'morning',
  name: '',
  phone: '',
  email: '',
  wantsCoach: false,
  coachId: null,
}

interface TrialPassProps {
  requestedCoachId: string | null
}

export function TrialPass({ requestedCoachId }: TrialPassProps) {
  const [selection, setSelection] =
    useState<BookingSelection>(initialSelection)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingSelection, string>>>({})
  const [pass, setPass] = useState<IssuedPass | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const ticketRef = useRef<HTMLDivElement>(null)

  /** Capture just the ticket element as a PNG and trigger download */
  const downloadTicket = async () => {
    const el = ticketRef.current
    if (!el) return
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#121212',
        scale: 2, // 2x for crisp output
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `reborn-pass-${pass?.bookingRef ?? 'ticket'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // Fallback: print just in case html2canvas fails
      window.print()
    }
  }

  const update = <K extends keyof BookingSelection>(
    key: K,
    value: BookingSelection[K],
  ) => {
    setSelection((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const applyCoachRequest = (coachId: string) => {
    setSelection((current) => ({
      ...current,
      wantsCoach: true,
      coachId,
    }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const next: Partial<Record<keyof BookingSelection, string>> = {}
    if (selection.name.trim().length < 2) next.name = 'Enter your full name'
    if (!/^[+\d][\d\s()-]{6,}$/.test(selection.phone.trim()))
      next.phone = 'Enter a reachable phone number'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(selection.email.trim()))
      next.email = 'Enter a valid email for your pass'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)

    // ──────────────────────────────────────────────────────────
    // OWNER NOTIFICATION INTEGRATION POINT:
    // To send this booking payload directly to the gym owner:
    //
    // OPTION A: EmailJS (https://www.emailjs.com/)
    // emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
    //   guest_name: selection.name,
    //   guest_phone: selection.phone,
    //   guest_email: selection.email,
    //   training_goal: selection.goalId,
    //   slot: `${selection.dayId} - ${selection.slotId}`,
    //   assigned_coach: selection.coachId ?? 'Floor Support',
    // }, 'YOUR_PUBLIC_KEY');
    //
    // OPTION B: Formspree (https://formspree.io/)
    // fetch('https://formspree.io/f/YOUR_FORM_ID', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(selection),
    // });
    //
    // OPTION C: Zapier / Make Webhook
    // fetch('https://hooks.zapier.com/hooks/catch/XXXXX/YYYYY/', {
    //   method: 'POST',
    //   body: JSON.stringify(selection)
    // });
    // ──────────────────────────────────────────────────────────

    window.setTimeout(() => {
      setSubmitting(false)
      setPass(issuePass(selection))
    }, 2000)
  }

  const reset = () => {
    setPass(null)
    setSelection(initialSelection)
    setErrors({})
  }

  return (
    <section id="trial-pass" className="scroll-mt-[var(--nav-h)] py-20 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Lead Engine / 01"
          title="Generate your 1-Day VIP pass"
          description="Pick your focus, lock a window, and we issue a scannable digital pass with your own entry code. Bring it, or show the code at the biometric turnstile."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card interactive className="p-6 sm:p-8">
            <form onSubmit={submit} noValidate className="flex flex-col gap-8">
              <fieldset>
                <legend className="label-telemetry mb-4 text-accent">
                  01 / Select your objective
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {goals.map((goal) => {
                    const Icon = goalIcons[goal.id] ?? Crosshair
                    const selected = selection.goalId === goal.id
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => update('goalId', goal.id)}
                        aria-pressed={selected}
                        className={cn(
                          'flex min-h-[56px] items-center gap-3 rounded border px-4 text-left transition-colors',
                          selected
                            ? 'border-accent/60 bg-accent/10 text-white'
                            : 'border-hairline text-muted hover:border-accent/40 hover:text-white',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            selected ? 'text-accent' : 'text-dim',
                          )}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold uppercase tracking-[0.08em]">
                          {goal.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="label-telemetry mb-4 text-accent">
                  02 / Date & time window
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {days.map((day) => (
                    <RadioTile
                      key={day.id}
                      name="day"
                      label={day.label}
                      detail={day.detail}
                      selected={selection.dayId === day.id}
                      onSelect={() => update('dayId', day.id)}
                    />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {daySlots.map((slot) => (
                    <RadioTile
                      key={slot.id}
                      name="slot"
                      label={slot.label}
                      detail={slot.detail}
                      selected={selection.slotId === slot.id}
                      onSelect={() => update('slotId', slot.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="label-telemetry mb-4 text-accent">
                  03 / Your details
                </legend>
                <div className="grid gap-3">
                  <Field
                    label="Full name"
                    value={selection.name}
                    onChange={(v) => update('name', v)}
                    error={errors.name}
                    placeholder="Alex Mercer"
                    autoComplete="name"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Phone"
                      type="tel"
                      value={selection.phone}
                      onChange={(v) => update('phone', v)}
                      error={errors.phone}
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={selection.email}
                      onChange={(v) => update('email', v)}
                      error={errors.email}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <label className="mt-1 flex min-h-[56px] cursor-pointer items-center gap-3 rounded border border-hairline px-4 transition-colors hover:border-accent/40">
                    <input
                      type="checkbox"
                      checked={selection.wantsCoach}
                      onChange={(event) =>
                        update('wantsCoach', event.target.checked)
                      }
                      className="h-5 w-5 shrink-0 accent-[#00f2fe]"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      Pair me with an elite coach
                    </span>
                  </label>

                  {selection.wantsCoach ? (
                    <ScrollReveal direction="rise" className="rounded border border-accent/20 bg-accent/5 p-4">
                      <p className="label-telemetry mb-3 text-accent">
                        Assigned guide
                      </p>
                      <div className="flex flex-col gap-2">
                        <CoachChoice
                          label="Floor support — first available"
                          selected={!selection.coachId}
                          onSelect={() => update('coachId', null)}
                        />
                        {coaches.map((coach) => (
                          <CoachChoice
                            key={coach.id}
                            label={`${coach.name} — ${coach.focus}`}
                            selected={selection.coachId === coach.id}
                            onSelect={() => update('coachId', coach.id)}
                          />
                        ))}
                      </div>
                    </ScrollReveal>
                  ) : null}
                </div>
              </fieldset>

              <ScrollReveal direction="rise" className="flex flex-col gap-3">
                {submitting ? (
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-md border border-accent bg-surface p-3 font-mono text-xs uppercase tracking-[0.12em] text-accent shadow-[3px_3px_0px_0px_#FFEE00]"
                  >
                    <span className="telemetry-dot bg-accent" aria-hidden="true" />
                    <span>GENERATING YOUR DIGITAL PASS...</span>
                  </div>
                ) : null}

                <Button type="submit" size="lg" fullWidth disabled={submitting}>
                  {submitting ? (
                    'GENERATING YOUR DIGITAL PASS...'
                  ) : (
                    <>
                      Generate Digital Day Pass
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </ScrollReveal>
            </form>
          </Card>

          <ScrollReveal direction="right" className="lg:sticky lg:top-28 lg:self-start">
            <Card className="overflow-hidden p-6 sm:p-8">
              <p className="label-telemetry text-accent">Pass protocol</p>
              <h3 className="display-lg mt-3 text-[1.75rem]">
                What happens after you book
              </h3>
              <ol className="mt-6 flex flex-col gap-4">
                {[
                  {
                    step: '01',
                    text: 'A high-contrast digital VIP boarding pass with your unique verification ID is generated instantly.',
                  },
                  {
                    step: '02',
                    text: 'Add the window to your calendar so you never miss the slot.',
                  },
                  {
                    step: '03',
                    text: 'Scan at the biometric turnstile and a coach briefs your session.',
                  },
                  {
                    step: '04',
                    text: 'Your telemetry baseline is captured before the first working set.',
                  },
                ].map((item) => (
                  <li key={item.step} className="flex gap-4">
                    <span className="font-mono text-xs text-accent">
                      {item.step}
                    </span>
                    <span className="text-sm leading-relaxed text-muted">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ol>

              {requestedCoachId ? (
                <Button
                  variant="lime"
                  fullWidth
                  className="mt-6"
                  onClick={() => applyCoachRequest(requestedCoachId)}
                >
                  Pair with{' '}
                  {coaches.find((c) => c.id === requestedCoachId)?.name ??
                    'coach'}
                </Button>
              ) : null}

              <p className="mt-6 font-mono text-[0.6875rem] uppercase leading-relaxed tracking-[0.14em] text-dim">
                {brand.address}
              </p>
            </Card>
          </ScrollReveal>
        </div>
      </div>

      <Modal
        open={!!pass}
        onClose={reset}
        eyebrow="Pass issued"
        title="Your day pass is live"
      >
        {pass ? (
          <div className="flex flex-col gap-6">
            {/* Digital Industrial Boarding Pass */}
            <div
              ref={ticketRef}
              className="relative overflow-hidden rounded-md border-2 border-dashed border-accent/60 bg-[#121212] p-6 shadow-[4px_4px_0px_0px_#FFEE00]"
            >
              {/* Header: Logo, Brand & Status Pill */}
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src="./logo.png"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = './logo.svg'
                    }}
                    alt="REBORN FITNESS"
                    className="h-10 w-10 rounded-sm border border-accent/40 bg-surface p-1 object-contain"
                  />
                  <div>
                    <p className="font-display text-base font-bold uppercase tracking-[0.14em] text-white">
                      REBORN FITNESS
                    </p>
                    <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-accent">
                      VIP TRIAL BOARDING PASS
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-1.5 rounded-sm border border-accent bg-accent px-3 py-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-canvas shadow-[2px_2px_0px_0px_#262626]">
                  VALID: 24 HOURS
                </span>
              </div>

              {/* Unique Verification Number */}
              <div className="mt-4 rounded border border-hairline bg-canvas/60 p-3">
                <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
                  UNIQUE VERIFICATION ID
                </p>
                <p className="mt-1 font-display text-xl font-bold tracking-[0.18em] text-accent">
                  PASS-RBN-{pass.entryCode}X
                </p>
              </div>

              {/* Ticket Details Grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-b border-dashed border-hairline pb-5">
                <div>
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
                    GUEST NAME
                  </p>
                  <p className="mt-0.5 truncate font-display text-sm font-semibold uppercase text-white">
                    {pass.guestName}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
                    TRAINING FOCUS
                  </p>
                  <p className="mt-0.5 truncate font-display text-sm font-semibold uppercase text-white">
                    {pass.goalLabel}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
                    ACCESS WINDOW
                  </p>
                  <p className="mt-0.5 font-display text-xs font-semibold uppercase text-accent">
                    {pass.dayLabel} · {pass.slotLabel}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
                    ASSIGNED GUIDE
                  </p>
                  <p className="mt-0.5 truncate font-display text-xs font-semibold uppercase text-white">
                    {pass.coachName ?? 'Floor Support'}
                  </p>
                </div>
              </div>

              {/* Industrial Barcode Graphic */}
              <div className="mt-4 flex flex-col items-center justify-center gap-1.5 pt-1">
                <div
                  className="flex h-10 w-full items-end justify-center gap-[3px] overflow-hidden opacity-90"
                  aria-hidden="true"
                >
                  {[4,2,6,1,3,5,2,4,1,6,3,2,5,1,4,2,3,6,1,5,2,4,3,1,6,2,5,3,1,4,2,6,1,3,5,2,4,1,6,3,2,5,1,4].map((w, i) => (
                    <span
                      key={i}
                      className="inline-block bg-white"
                      style={{
                        width: `${w}px`,
                        height: i % 7 === 0 ? '100%' : '85%',
                      }}
                    />
                  ))}
                </div>
                <p className="font-mono text-[0.625rem] tracking-[0.24em] text-dim">
                  * PASS-RBN-{pass.entryCode}X *
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button size="lg" fullWidth onClick={downloadTicket}>
                DOWNLOAD TICKET
              </Button>
              <Button variant="ghost" fullWidth onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Book another pass
              </Button>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-dim">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime" aria-hidden="true" />
              This pass is held for your selected window. Show the code at the entry
              turnstile — the biometric lane opens automatically for active passes.
            </p>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}

function RadioTile({
  name,
  label,
  detail,
  selected,
  onSelect,
}: {
  name: string
  label: string
  detail: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}, ${detail}`}
      onClick={onSelect}
      className={cn(
        'flex min-h-[72px] flex-col items-start justify-center gap-1 rounded border px-4 text-left transition-colors',
        selected
          ? 'border-accent/60 bg-accent/10'
          : 'border-hairline hover:border-accent/40',
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {label}
        </span>
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full border',
            selected ? 'border-accent bg-accent' : 'border-hairline',
          )}
          aria-hidden="true"
        >
          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-canvas" /> : null}
        </span>
      </span>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-dim">
        {detail}
      </span>
      <input type="hidden" name={name} value={selected ? 'true' : 'false'} readOnly />
    </button>
  )
}

function CoachChoice({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-[48px] items-center justify-between gap-3 rounded border px-4 text-left text-xs font-semibold uppercase tracking-[0.06em] transition-colors',
        selected
          ? 'border-accent/60 bg-accent/10 text-white'
          : 'border-hairline text-muted hover:border-accent/40 hover:text-white',
      )}
    >
      {label}
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      ) : null}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  placeholder: string
  autoComplete?: string
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'min-h-[52px] rounded border bg-surface/60 px-4 text-sm text-white placeholder:text-dim/70 transition-colors',
          error
            ? 'border-red-400/70 focus:border-red-400'
            : 'border-hairline focus:border-accent/60',
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}