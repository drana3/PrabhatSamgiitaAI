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
