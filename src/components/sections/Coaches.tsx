import { ArrowUpRight, Instagram } from 'lucide-react'
import { coaches } from '../../data/coaches'
import { social } from '../../data/site'
import { Button, LinkButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

interface CoachesProps {
  onBookWithCoach: (coachId: string) => void
}

export function Coaches({ onBookWithCoach }: CoachesProps) {
  return (
    <section className="py-20 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Your Trainer / 05"
          title="Meet your trainer"
          description="REBORN FITNESS is run by Chandan, your point of contact for training, sessions and memberships."
        />

        <ul className="mx-auto mt-12 flex max-w-3xl flex-col gap-4">
          {coaches.map((coach) => (
            <ScrollReveal key={coach.id} direction="rise">
              <Card
                interactive
                className="flex h-full flex-col gap-6 p-6 sm:flex-row sm:p-8"
              >
                <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded border border-hairline bg-gradient-to-b from-accent/10 to-surface sm:w-48 sm:shrink-0">
                  {coach.image ? (
                    <img
                      src={coach.image}
                      alt={coach.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-2 p-4 text-center">
                      <span
                        className="font-display text-6xl font-bold leading-none text-accent"
                        aria-hidden="true"
                      >
                        {coach.name.charAt(0)}
                      </span>
                      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-dim">
                        Photo coming soon
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col">
                  <h3 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white">
                    {coach.name}
                  </h3>
                  <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-accent">
                    {coach.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {coach.bio}
                  </p>

                  {coach.certifications && coach.certifications.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {coach.certifications.map((cert) => (
                        <li
                          key={cert}
                          className="rounded-full border border-hairline bg-white/5 px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted"
                        >
                          {cert}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => onBookWithCoach(coach.id)}
                    >
                      Book a session
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <LinkButton
                      href={social.instagram.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      fullWidth
                    >
                      <Instagram className="h-4 w-4 text-accent" aria-hidden="true" />
                      Instagram
                    </LinkButton>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
