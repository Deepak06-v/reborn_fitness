import { ArrowUpRight, BadgeCheck } from 'lucide-react'
import { coaches } from '../../data/coaches'
import { Button } from '../ui/Button'
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
          eyebrow="Performance Guides / 05"
          title="Coaches who read your data"
          description="Every guide on the floor holds a recognised coaching certification and works from your telemetry, not just a program on paper."
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {coaches.map((coach, index) => (
            <ScrollReveal key={coach.id} direction="rise" delay={index * 0.06}>
              <Card interactive className="flex h-full flex-col">
                <div className="relative aspect-[3/4] overflow-hidden rounded-t">
                  <img
                    src={coach.image}
                    alt={coach.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-75"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-sm font-bold uppercase tracking-[0.04em] text-white">
                    {coach.name}
                  </h3>
                  <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-accent">
                    {coach.focus}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {coach.bio}
                  </p>

                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {coach.certifications.map((cert) => (
                      <li
                        key={cert}
                        className="flex items-center gap-1 rounded-full border border-hairline bg-white/5 px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted"
                      >
                        <BadgeCheck
                          className="h-3 w-3 text-lime"
                          aria-hidden="true"
                        />
                        {cert}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    className="mt-5"
                    onClick={() => onBookWithCoach(coach.id)}
                  >
                    Book trial with this coach
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  )
}