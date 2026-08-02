import { useLayoutEffect, useRef } from 'react'

/**
 * Shrinks its content to fit the available height/width instead of letting a long section
 * (6–8 lines) overflow or clip off a stage monitor. Uses `zoom` (not `transform: scale`) so
 * the box itself shrinks and the browser reflows around it — same technique SetListView
 * already uses (`fitPerformerStage`) to fit chart pages to the screen. Scaling down the whole
 * already-wrapped block (rather than shrinking font-size directly) keeps the chart's line
 * breaks and proportions intact instead of causing it to rewrap into a different shape.
 * Shared by PresentDisplay (performer cue sheet) and PresentAudience (crowd-facing screen).
 */
export default function FitBox({ children, deps, className }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    function fit() {
      inner.style.zoom = 1
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const needH  = inner.scrollHeight
      const needW  = inner.scrollWidth
      const scale  = Math.min(1, availH / (needH || 1), availW / (needW || 1))
      inner.style.zoom = Math.max(0.3, scale)
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return (
    <div className={className} ref={outerRef}>
      <div ref={innerRef} style={{ width: '100%' }}>{children}</div>
    </div>
  )
}
