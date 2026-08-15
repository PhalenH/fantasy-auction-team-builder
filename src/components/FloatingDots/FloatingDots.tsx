// Exploratory ambient background decoration ("let's see it in place and
// decide", not a committed design choice) — kept as one isolated,
// self-contained component so trying it out, or pulling it back out later,
// is a one-line add/remove at the call site (see SavedRosters.tsx) rather
// than something woven into individual card/page markup.
//
// Purely decorative (aria-hidden, pointer-events-none) and absolutely
// positioned to fill whichever `position: relative; overflow: hidden`
// wrapper it's placed in — it never introduces a background color of its
// own, only the drifting dots on top of whatever background already exists
// there. Ships its own negative z-index so it always paints behind normal
// in-flow content in that wrapper (the wrapper's real content needs no
// z-index of its own for this to work, as long as the wrapper itself
// doesn't already set one) — the caller only needs to add the
// position/overflow wrapper and render this first, nothing else to wire up
// for correct stacking.
//
// Colors: dim white (~0.26-0.32 opacity) plus three green shades at
// ~0.42-0.65 opacity — rgb(99, 153, 34), rgb(151, 196, 89), rgb(39, 80, 10)
// — matching the approved mockup rather than the app's own accent-green
// token; a density/visibility tuning pass bumped these up from an earlier,
// dimmer/sparser attempt (see git history) once the brighter mockup was the
// one that actually read well against bg-page-dark.
//
// Each dot drifts back and forth via one shared @keyframes (FloatingDots.css)
// — translateX(0) -> translateX(var(--dx)) -> translateX(0) — with its own
// --dx (drift distance), animation-duration, and a *negative*
// animation-delay so every dot starts already mid-cycle instead of all
// fifteen beginning in sync on load.

import './FloatingDots.css'

interface DotConfig {
  top: string
  left: string
  size: number
  color: string
  dx: number
  duration: number
  delay: number
}

const DOTS: DotConfig[] = [
  { top: '5%', left: '8%', size: 4, color: 'rgba(255, 255, 255, 0.28)', dx: 32, duration: 18, delay: -3 },
  { top: '12%', left: '55%', size: 5, color: 'rgba(99, 153, 34, 0.48)', dx: -30, duration: 22, delay: -9 },
  { top: '20%', left: '90%', size: 4, color: 'rgba(255, 255, 255, 0.31)', dx: 40, duration: 25, delay: -14 },
  { top: '28%', left: '25%', size: 6, color: 'rgba(39, 80, 10, 0.6)', dx: -24, duration: 19, delay: -5 },
  { top: '35%', left: '70%', size: 4, color: 'rgba(151, 196, 89, 0.5)', dx: 34, duration: 27, delay: -12 },
  { top: '42%', left: '12%', size: 5, color: 'rgba(255, 255, 255, 0.26)', dx: -46, duration: 16, delay: -7 },
  { top: '48%', left: '45%', size: 4, color: 'rgba(99, 153, 34, 0.55)', dx: 28, duration: 23, delay: -18 },
  { top: '55%', left: '82%', size: 6, color: 'rgba(39, 80, 10, 0.64)', dx: -38, duration: 21, delay: -4 },
  { top: '62%', left: '5%', size: 4, color: 'rgba(255, 255, 255, 0.32)', dx: 50, duration: 26, delay: -10 },
  { top: '68%', left: '35%', size: 5, color: 'rgba(151, 196, 89, 0.44)', dx: -20, duration: 17, delay: -15 },
  { top: '75%', left: '60%', size: 6, color: 'rgba(255, 255, 255, 0.29)', dx: 42, duration: 24, delay: -6 },
  { top: '80%', left: '92%', size: 4, color: 'rgba(99, 153, 34, 0.42)', dx: -34, duration: 20, delay: -13 },
  { top: '87%', left: '18%', size: 5, color: 'rgba(39, 80, 10, 0.58)', dx: 26, duration: 15, delay: -2 },
  { top: '92%', left: '48%', size: 4, color: 'rgba(255, 255, 255, 0.27)', dx: -28, duration: 22, delay: -16 },
  { top: '96%', left: '78%', size: 6, color: 'rgba(151, 196, 89, 0.52)', dx: 36, duration: 19, delay: -8 },
]

function FloatingDots() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {DOTS.map((dot, index) => (
        <span
          key={index}
          className="floating-dot"
          style={
            {
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              backgroundColor: dot.color,
              '--dx': `${dot.dx}px`,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export default FloatingDots
