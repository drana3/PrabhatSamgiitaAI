export function stickyHeaderOffset() {
  if (typeof document === "undefined") return 0
  const sticky = document.querySelector(".sticky.top-0")
  return sticky?.getBoundingClientRect().height ?? 0
}

export function scrollToSectionId(sectionId: string, extraGap = 8) {
  const element = document.getElementById(sectionId)
  if (!element) return
  const top = element.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset() - extraGap
  window.scrollTo({ top: Math.max(top, 0), behavior: "auto" })
}
