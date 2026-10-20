export function LoadingIndicator({
  label = "Loading",
  compact = false,
  /** aria-live can scroll the status into view on long song pages — opt out for inline CI progress. */
  live = true,
}: {
  label?: string
  compact?: boolean
  live?: boolean
}) {
  return (
    <span
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={`inline-flex items-center justify-center gap-3 ${compact ? "text-xs" : "text-sm"}`}
    >
      <span aria-hidden="true" className={`${compact ? "h-4 w-4 border-2" : "h-6 w-6 border-[3px]"} animate-spin rounded-full border-gold-200 border-t-gold-700`} />
      <span>{label}</span>
    </span>
  )
}
