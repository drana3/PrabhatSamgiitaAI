/**
 * "Download on Wi-Fi only" as pure rules. The network itself is read in lib/offline/network.ts.
 *
 *   kind        what the phone is on
 *   "wifi"      Wi-Fi
 *   "cellular"  mobile data (the only thing the rule blocks)
 *   "other"     Ethernet, VPN, Bluetooth tethering: not mobile data as far as the phone can tell
 *   "none"      no connection
 *   "unknown"   the phone could not tell (the network module is missing or failed)
 */
export type NetworkKind = "wifi" | "cellular" | "other" | "none" | "unknown"

type ExpoNetworkState = { type?: string | null; isConnected?: boolean | null }

/** From what `expo-network` reports (`type` is "WIFI", "CELLULAR", ...). */
export function networkKindFrom(state: ExpoNetworkState | null | undefined): NetworkKind {
  if (!state) return "unknown"
  if (state.isConnected === false) return "none"
  switch (String(state.type ?? "").toUpperCase()) {
    case "WIFI":
      return "wifi"
    case "CELLULAR":
      return "cellular"
    case "NONE":
      return "none"
    case "UNKNOWN":
    case "":
      return "unknown"
    default:
      return "other"
  }
}

/**
 * A download the person asked for: only mobile data is blocked, and only while "Wi-Fi only" is on and the
 * person has not said "Download anyway". A phone that cannot tell its network is not blocked (the download
 * then fails on its own if there is no connection).
 */
export function blockedByWifiRule(input: { wifiOnly: boolean; kind: NetworkKind; allowCellular?: boolean }): boolean {
  return input.wifiOnly && !input.allowCellular && input.kind === "cellular"
}

/**
 * Continuing a half-finished download by itself, with nobody asking: stricter. With "Wi-Fi only" on it needs
 * Wi-Fi (or a wired/other link); with it off any working connection will do. Unknown never starts by itself.
 */
export function mayAutoResume(input: { wifiOnly: boolean; kind: NetworkKind }): boolean {
  if (input.kind === "none" || input.kind === "unknown") return false
  if (!input.wifiOnly) return true
  return input.kind === "wifi" || input.kind === "other"
}
