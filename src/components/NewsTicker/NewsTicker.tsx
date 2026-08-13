// Decorative scrolling banner above the Setup card. Purely novelty content
// (no draft-relevant information), so the whole thing is aria-hidden rather
// than having a screen reader repeat "Go Birds" dozens of times.
//
// Seamless-loop mechanics: ONE_COPY below is "Go Birds" repeated with wide
// spacing, rendered TWICE back to back inside a single inline-block wrapper
// (whitespace-nowrap keeps both copies on one line so the wrapper's natural
// width is exactly 2x one copy's width). The animate-ticker utility
// (src/index.css) animates that wrapper from translateX(0) to
// translateX(-50%) — i.e. left by exactly one copy-width — so the instant
// it resets, copy two is already sitting exactly where copy one started.
// No jump, no gap.

const TICKER_TEXT = 'Go Birds'
const REPEATS_PER_COPY = 10

function TickerCopy({ copyKey }: { copyKey: string }) {
  return (
    <>
      {Array.from({ length: REPEATS_PER_COPY }, (_, index) => (
        <span key={`${copyKey}-${index}`} className="mx-10 text-sm font-semibold tracking-wide text-white">
          {TICKER_TEXT}
        </span>
      ))}
    </>
  )
}

function NewsTicker() {
  return (
    <div aria-hidden="true" className="w-full overflow-hidden border-y border-white/10 bg-page-dark py-2">
      {/* motion-reduce:animate-none: prefers-reduced-motion gets the text
          statically visible (one copy, motionless) instead of a moving banner. */}
      <div className="inline-block w-max animate-ticker whitespace-nowrap motion-reduce:animate-none">
        <TickerCopy copyKey="a" />
        <TickerCopy copyKey="b" />
      </div>
    </div>
  )
}

export default NewsTicker
