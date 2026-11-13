import { type ReactNode } from "react"
import { Modal, Platform, StyleSheet, Text, View } from "react-native"
import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context"
import { X } from "lucide-react-native"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSheetTop } from "@/hooks/useScreenTop"
import { MODAL_HEADER_GAP_BELOW, MODAL_HEADER_MIN_HEIGHT } from "@/lib/screenTop"

/**
 * THE way to draw a full-screen picker sheet with React Native's <Modal> (a song chooser, a language list, a year list).
 * Never write `<Modal presentationStyle="pageSheet">` by hand: the title and the close button must start below the
 * status bar and the Dynamic Island, and a hand-written header forgot it twice (the song chooser and the language list
 * of the upload forms had their title under the island and the close button under the battery).
 *
 * Two things make it right. ModalSafeArea measures the safe area INSIDE the sheet (a Modal is its own native view, and
 * iOS may draw it under the island or below it, depending on what is open under it), and the header takes its top from
 * the one rule in lib/screenTop.ts. __tests__/layoutRules.test.ts fails for any screen that opens a Modal without it.
 */

/** Gives everything inside a Modal the insets of the Modal itself, not the window's. The browser preview keeps the frame's insets. */
export function ModalSafeArea({ children }: { children: ReactNode }) {
  const outer = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  if (Platform.OS === "web") return <>{children}</>
  // the window's insets are the first guess (never under the island), the measured ones replace them a frame later
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets: outer }} style={styles.fill}>
      {children}
    </SafeAreaProvider>
  )
}

/** The title row of a picker sheet: the title on the left, the close button on the right, both below the island. */
export function ModalHeader({ title, closeLabel, onClose }: { title: string; closeLabel: string; onClose: () => void }) {
  const p = protoFor(useAmTheme())
  const top = useSheetTop()
  return (
    <View style={[styles.header, { paddingTop: top, paddingBottom: MODAL_HEADER_GAP_BELOW, minHeight: top + MODAL_HEADER_MIN_HEIGHT - 8 }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: p.ink800 }]} numberOfLines={2}>
        {title}
      </Text>
      <PressBox accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} pressedScale={0.9} style={[styles.close, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <X size={20} color={p.ink800} strokeWidth={2} />
      </PressBox>
    </View>
  )
}

export function SheetModal({ visible, title, closeLabel, onClose, children }: { visible: boolean; title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const p = protoFor(useAmTheme())
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
      <ModalSafeArea>
        <View style={[styles.fill, { backgroundColor: p.sand200 }]}>
          <ModalHeader title={title} closeLabel={closeLabel} onClose={onClose} />
          {children}
        </View>
      </ModalSafeArea>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20 },
  heading: { flex: 1, minWidth: 0, fontFamily: amFonts.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.5, textTransform: "uppercase" },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
})
