import { Platform } from "react-native"

/**
 * Shared list tuning. Same batch sizes on iOS and Android so search / catalog
 * feel the same; Android only clips off-screen rows (native overdraw).
 */
export const listPerfProps = {
  removeClippedSubviews: Platform.OS === "android",
  initialNumToRender: 10,
  maxToRenderPerBatch: 8,
  windowSize: 8,
  updateCellsBatchingPeriod: 50,
}
