import { BackHandler } from "react-native"

/**
 * Android hardware Back (and the Back gesture) while a sheet is open: close the sheet, not the screen under it.
 * BackHandler asks the listeners newest first and stops at the first that returns true, so the sheet opened last
 * closes first and the screen's own handler is only reached when no sheet is left. Always returns true.
 * On iOS and web BackHandler never fires, so this is a harmless no-op there.
 */
export function registerSheetBack(close: () => void): () => void {
  const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
    close()
    return true
  })
  return () => subscription.remove()
}
