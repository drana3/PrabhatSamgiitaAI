export function stickyHeaderOffset() {
  if (typeof document === "undefined") return 0
  const sticky = document.querySelector(".sticky.top-0")
  return sticky?.getBoundingClientRect().height ?? 0
}

export function scrollToSectionId(
  sectionId: string,
  options?: { extraGap?: number; behavior?: ScrollBehavior },
) {
  const element = document.getElementById(sectionId)
  if (!element) return
  const extraGap = options?.extraGap ?? 8
  const top = element.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset() - extraGap
  const reduceMotion = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const behavior = options?.behavior ?? "auto"
  window.scrollTo({
    top: Math.max(top, 0),
    behavior: reduceMotion ? "auto" : behavior,
  })
}

/** Keep a focused search field (and suggestions) visible above the mobile keyboard. */
export function scrollElementAboveKeyboard(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") return
  if (typeof window.matchMedia === "function" && !window.matchMedia("(max-width: 767px)").matches) {
    return
  }

  const reduceMotion = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const run = () => {
    const viewport = window.visualViewport
    const visibleTop = viewport?.offsetTop ?? 0
    const header = stickyHeaderOffset()
    const targetTop = visibleTop + header + 10
    const delta = element.getBoundingClientRect().top - targetTop
    if (Math.abs(delta) < 10) return
    window.scrollBy({
      top: delta,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  run()
  requestAnimationFrame(() => requestAnimationFrame(run))
  window.setTimeout(run, 120)
  window.setTimeout(run, 320)
}
