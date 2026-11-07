import { networkKindFrom, type NetworkKind } from "@/lib/offline/networkRule"

/**
 * What the phone is connected to now. `expo-network` is a native module: an older build that does not have
 * it yet answers "unknown" instead of crashing, and "unknown" never blocks a download the person asked for.
 */
export async function readNetworkKind(): Promise<NetworkKind> {
  try {
    const Network = require("expo-network") as typeof import("expo-network")
    return networkKindFrom(await Network.getNetworkStateAsync())
  } catch {
    return "unknown"
  }
}
