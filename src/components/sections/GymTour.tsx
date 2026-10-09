import { Boxes, ExternalLink } from 'lucide-react'
import { LinkButton } from '../ui/Button'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

/**
 * Hosted Momento360 360-degree panorama of the facility.
 * The URL and its query parameters are preserved verbatim from the source embed.
 */
const TOUR_URL =
  'https://momento360.com/e/u/649cd9295a8d43a2a43ee351eba69e89?utm_campaign=embed&utm_source=other&utm_medium=embed&heading=0&pitch=0&field-of-view=75&size=medium&display-plan=true'

export function GymTour() {
  return (
    <section
      id="gym-tour"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-20 sm:py-28"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Virtual Experience"
          title="Explore the Gym in 3D"
          description="Step inside the floor from anywhere. Drag the panorama to look around and preview the racks, telemetry lanes and recovery bays before you visit."
        />

        <ScrollReveal direction="rise" className="mt-10">
          <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <span className="flex items-center gap-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-accent">
                <Boxes className="h-4 w-4" aria-hidden="true" />
                360° Panorama
              </span>
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
                Drag to look around
              </span>
            </div>

            <div className="relative h-[380px] w-full sm:h-[460px] lg:h-[560px]">
              <iframe
                src={TOUR_URL}
                title="REBORN FITNESS interactive 360-degree gym tour"
                width="100%"
                loading="lazy"
                allowFullScreen
                allow="accelerometer; gyroscope; fullscreen; xr-spatial-tracking"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[52ch] text-sm leading-relaxed text-muted">
            Tour not loading? Open the immersive experience in its own tab.
          </p>
          <LinkButton
            href={TOUR_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open 3D Tour in a New Tab
          </LinkButton>
        </div>
      </div>
    </section>
  )
}
