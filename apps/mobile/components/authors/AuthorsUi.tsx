import type { ReactNode } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { ArtistAvatar } from "@/components/kirtan/ArtistParts"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { apiBaseUrl } from "@/lib/client"
import { useT } from "@/lib/i18n"

/** Side padding of the author pages (the same as the lists of the app). */
export const SIDE = 20

/** react-native-web paints the "on" knob of a Switch teal unless `activeThumbColor` is set; native ignores it. */
export const WEB_THUMB = { activeThumbColor: "#FFFFFF" } as Record<string, string>

/** The picture URL the API gives is relative to the API; the avatar needs it whole. */
export function photoSrc(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:/i.test(url) ? url : `${apiBaseUrl.replace(/\/+$/, "")}${url}`
}

/** A round picture of an author; initials on the gradient while there is no photo. */
export function AuthorAvatar({ slug, name, photoUrl, size }: { slug: string; name: string; photoUrl: string | null; size: number }) {
  return <ArtistAvatar artist={{ id: slug, name, photoUrl: photoSrc(photoUrl) }} size={size} />
}

/** "Demo": every screen that shows invented pages carries it, so nobody mistakes a sample for a real author. */
export function DemoBadge({ theme }: { theme: SongsTheme }) {
  const t = useT()
  return (
    <View accessibilityLabel={t("authors.demoNote")} style={[styles.demo, { borderColor: theme.accentText }]}>
      <Text style={[styles.demoText, { color: theme.accentText }]}>{t("authors.demo")}</Text>
    </View>
  )
}

/** Banner under the title in the preview: what the Demo label means. */
export function DemoNote({ theme }: { theme: SongsTheme }) {
  const t = useT()
  return (
    <View style={[styles.note, { backgroundColor: theme.peach }]}>
      <DemoBadge theme={theme} />
      <Text style={[styles.noteText, { color: theme.textHeading }]}>{t("authors.demoNote")}</Text>
    </View>
  )
}

type Tone = "brand" | "line" | "quiet" | "danger"

export function PillButton({
  theme,
  label,
  onPress,
  tone = "brand",
  icon,
  disabled,
  busy,
  a11y,
  flex,
}: {
  theme: SongsTheme
  label: string
  onPress: () => void
  tone?: Tone
  icon?: ReactNode
  disabled?: boolean
  busy?: boolean
  a11y?: string
  flex?: boolean
}) {
  const fill = tone === "brand" ? theme.brand : "transparent"
  const ink = tone === "brand" ? theme.onBrand : tone === "danger" ? theme.dangerText : tone === "quiet" ? theme.accentText : theme.textHeading
  const border = tone === "line" ? theme.line : tone === "danger" ? theme.dangerText : "transparent"
  const inactive = Boolean(disabled || busy)
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(busy) }}
      disabled={inactive}
      onPress={onPress}
      pressedScale={0.97}
      outerStyle={flex ? styles.flex : undefined}
      style={[styles.pill, { backgroundColor: fill, borderColor: border, borderWidth: border === "transparent" ? 0 : 1, opacity: disabled && !busy ? 0.45 : 1 }]}
    >
      {busy ? <ActivityIndicator size="small" color={ink} /> : icon}
      <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </KPress>
  )
}

export function Chip({ theme, label, active, onPress, count }: { theme: SongsTheme; label: string; active: boolean; onPress: () => void; count?: number }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      pressedScale={0.95}
      style={[styles.chip, { backgroundColor: active ? theme.ink900 : "transparent", borderColor: active ? theme.ink900 : theme.line }]}
    >
      <Text style={[styles.chipText, { color: active ? theme.onInk : theme.textHeading }]}>{label}</Text>
      {count == null ? null : <Text style={[styles.chipCount, { color: active ? theme.onInk : theme.textMuted }]}>{count}</Text>}
    </KPress>
  )
}

export function SectionTitle({ theme, children }: { theme: SongsTheme; children: ReactNode }) {
  return (
    <Text style={[styles.section, { color: theme.textHeading }]} accessibilityRole="header">
      {children}
    </Text>
  )
}

/** A centred message for empty, error and not-found states, with one optional action. */
export function StateBlock({
  theme,
  title,
  body,
  action,
  onAction,
  tone,
}: {
  theme: SongsTheme
  title: string
  body?: string
  action?: string
  onAction?: () => void
  tone?: "error"
}) {
  return (
    <View style={styles.state} accessibilityRole={tone === "error" ? "alert" : undefined}>
      <Text style={[styles.stateTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[styles.stateBody, { color: tone === "error" ? theme.dangerText : theme.textBody }]}>{body}</Text> : null}
      {action && onAction ? (
        <View style={styles.stateAction}>
          <PillButton theme={theme} label={action} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}

/** Grey placeholder rows while a page loads (no spinner that jumps; the shapes already say "a list is coming"). */
export function LoadingRows({ theme, rows = 4 }: { theme: SongsTheme; rows?: number }) {
  const t = useT()
  return (
    <View style={styles.loading} accessibilityLabel={t("authors.loading")} accessibilityLiveRegion="polite">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.skeleton, { backgroundColor: theme.inner, borderColor: theme.line }]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  demo: { alignSelf: "flex-start", borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  demoText: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, textTransform: "uppercase" },
  note: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: SIDE, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  noteText: { flex: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  pill: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  pillText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14 },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  chipCount: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  section: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, textTransform: "uppercase", paddingHorizontal: SIDE },
  state: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  stateTitle: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26, textAlign: "center" },
  stateBody: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  stateAction: { alignSelf: "stretch", marginTop: 14 },
  loading: { paddingHorizontal: SIDE, gap: 10, paddingTop: 12 },
  skeleton: { height: 64, borderRadius: 16, borderWidth: 1 },
})
