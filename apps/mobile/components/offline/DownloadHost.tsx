import { useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { signInBody, signInTitle } from "@/lib/offline/downloadModel"
import { useDownloadUiStore, type DownloadPrompt, type DownloadToast } from "@/stores/downloadUiStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

const RISE_MS = 280

/** The one quiet line (with Retry after a failure). Sits at the top, under the status bar, like the Save toast. */
function Toast({ toast }: { toast: DownloadToast }) {
  const theme = useAmTheme()
  const reduce = useReducedMotion()
  const insets = useSafeAreaInsets()
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.value = 0
    shown.value = withTiming(1, { duration: RISE_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [toast.id, shown])
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * -16 }],
  }))
  const hide = useDownloadUiStore((s) => s.hideToast)
  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: Math.max(insets.top, 12) + 8, backgroundColor: theme.textHeading }, style]}
    >
      <Text style={[styles.toastText, { color: theme.page }]} numberOfLines={1}>
        {toast.message}
      </Text>
      {toast.actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.actionLabel}
          hitSlop={8}
          onPress={() => {
            hide()
            toast.onAction?.()
          }}
          style={styles.toastAction}
        >
          <Text style={[styles.toastActionText, { color: theme.page }]}>{toast.actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

/** Sign-in prompt and "Remove download?" confirm, in the player's sheet. */
function PromptSheet({ prompt, onClose }: { prompt: DownloadPrompt | null; onClose: () => void }) {
  const t = useT()
  const theme = useAmTheme()
  const router = useRouter()
  const last = useRef<DownloadPrompt | null>(null)
  if (prompt) last.current = prompt
  const shown = prompt ?? last.current
  const visible = prompt != null
  if (!shown) return null
  const signin = shown.kind === "signin"
  return (
    <Sheet visible={visible} onClose={onClose} title={signin ? t("dl.menu.download") : shown.copy.heading} theme={theme} hideDone>
      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={3}>
          {signin ? signInTitle() : shown.copy.name}
        </Text>
        <Text style={[styles.text, { color: theme.textBody }]}>{signin ? signInBody() : shown.copy.body}</Text>
        <View style={styles.pills}>
          <View style={styles.pill}>
            <SheetPill theme={theme} tone="sand" label={signin ? t("common.notNow") : shown.copy.keep} onPress={onClose} />
          </View>
          <View style={styles.pill}>
            <SheetPill
              theme={theme}
              tone="brand"
              label={signin ? t("account.signIn.title") : shown.copy.confirm}
              onPress={() => {
                onClose()
                if (shown.kind === "signin") router.push(href("/signin"))
                else shown.onConfirm()
              }}
            />
          </View>
        </View>
      </View>
    </Sheet>
  )
}

/** Draws what the download controls ask for: the prompt sheet and the toast. Mounted by SaveHost. */
export function DownloadHost() {
  const prompt = useDownloadUiStore((s) => s.prompt)
  const toast = useDownloadUiStore((s) => s.toast)
  const close = useDownloadUiStore((s) => s.closePrompt)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <PromptSheet prompt={prompt} onClose={close} />
      {toast ? <Toast toast={toast} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  name: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  text: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  pills: { flexDirection: "row", gap: 10, marginTop: 8 },
  pill: { flex: 1 },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 48,
    paddingLeft: 20,
    paddingRight: 8,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 90,
  },
  toastText: { flex: 1, fontFamily: amFonts.semi, fontSize: 14 },
  toastAction: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
  toastActionText: { fontFamily: amFonts.bold, fontSize: 14, textDecorationLine: "underline" },
})
