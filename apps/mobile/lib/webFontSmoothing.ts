/**
 * Web only. The design prototype sets `-webkit-font-smoothing: antialiased`; without it
 * Chrome on macOS draws the same Roboto weights visibly heavier. Idempotent, safe to import
 * from several places. TODO: import once from the root layout when the redesign is merged.
 */
export function ensureWebFontSmoothing(): void {
  if (typeof document === "undefined") return
  if (document.getElementById("am-font-smoothing")) return
  const style = document.createElement("style")
  style.id = "am-font-smoothing"
  style.textContent = "html,body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}"
  document.head.appendChild(style)
}

ensureWebFontSmoothing()
