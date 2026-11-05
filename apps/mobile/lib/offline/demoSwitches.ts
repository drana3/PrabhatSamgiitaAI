import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Preview-only switches for the web build with sample data (EXPO_PUBLIC_MOCKUP_DATA=1), so the two
 * states a clicker can not reach by itself can be shown: a signed-out listener and a download that
 * fails. Set in the browser console: localStorage.setItem("ps.demo.signedOut", "1") and
 * localStorage.setItem("ps.demo.downloadFails", "1"). Never read on a device.
 */
function flag(name: string): boolean {
  if (!MOCKUP_DATA) return false
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(name) === "1"
  } catch {
    return false
  }
}

export const demoSignedOut = () => flag("ps.demo.signedOut")
export const demoDownloadFails = () => flag("ps.demo.downloadFails")
