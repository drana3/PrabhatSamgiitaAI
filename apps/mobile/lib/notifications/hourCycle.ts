/**
 * Does this device show the time on a 12-hour clock (7:45 AM) or a 24-hour clock (7:45)?
 * Read from the device locale through Intl. When Intl cannot say (older engines), 12-hour:
 * the app's copy is English.
 */
export function detect12Hour(resolve?: () => { hour12?: boolean; hourCycle?: string }): boolean {
  try {
    const options = resolve ? resolve() : new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions()
    if (typeof options.hour12 === "boolean") return options.hour12
    if (options.hourCycle === "h23" || options.hourCycle === "h24") return false
    if (options.hourCycle === "h11" || options.hourCycle === "h12") return true
  } catch {
    /* no Intl */
  }
  return true
}

let cached: boolean | undefined

/** The device's clock, read once. */
export function uses12Hour(): boolean {
  if (cached === undefined) cached = detect12Hour()
  return cached
}
