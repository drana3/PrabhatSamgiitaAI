/**
 * The events the app may send, and for each the properties it may carry (docs/analytics-flags.md).
 * The server keeps the same list (apps/api/app/services/telemetry.py `EVENTS`) and drops anything
 * else; `__tests__/analytics.test.ts` fails if the two lists drift apart.
 *
 * Rules: no account id, no e-mail, no name, no search text, no song or recording title, no free
 * text of any kind. A string property is a short lowercase token (`voice`, `kiirtan`, `step_2`).
 */
export const EVENT_SPEC = {
  app_open: ["cold"],
  screen_view: ["screen"],
  search: ["mode", "has_results", "results"],
  song_open: ["source"],
  play_start: ["kind", "source"],
  radio_start: ["pool"],
  radio_stop: ["pool", "minutes"],
  upload_start: ["kind"],
  upload_step: ["wizard", "step", "n"],
  upload_done: ["kind"],
  upload_fail: ["kind", "reason"],
  wizard_step: ["wizard", "step"],
  share: ["kind", "channel"],
  error: ["code", "screen"],
  consent_change: ["mode"],
  flag_exposure: ["flag", "variant"],
} as const satisfies Record<string, readonly string[]>

export type EventName = keyof typeof EVENT_SPEC
export type PropValue = string | number | boolean
export type EventProps = Readonly<Record<string, PropValue | undefined>>

export const MAX_PROPS = 6
const TOKEN = /^[a-z0-9][a-z0-9_.:-]{0,39}$/

/** Keep only the listed properties with safe values; the same rule the server applies. */
export function sanitizeProps(name: EventName, props: EventProps | undefined): Record<string, PropValue> {
  const allowed: readonly string[] = EVENT_SPEC[name]
  const out: Record<string, PropValue> = {}
  if (!props) return out
  for (const [key, value] of Object.entries(props)) {
    if (!allowed.includes(key) || Object.keys(out).length >= MAX_PROPS) continue
    if (typeof value === "boolean") out[key] = value
    else if (typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= 1_000_000) out[key] = value
    else if (typeof value === "string" && TOKEN.test(value)) out[key] = value
  }
  return out
}

export function isEventName(value: string): value is EventName {
  return Object.prototype.hasOwnProperty.call(EVENT_SPEC, value)
}
