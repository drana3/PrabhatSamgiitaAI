import { StyleSheet, Text, View } from "react-native"
import { StatusBar } from "expo-status-bar"

import {
  OnbButton,
  OnbEyebrow,
  OnbGroup,
  OnbHeading,
  OnbNote,
  OnbPage,
  OnbReveal,
  OnbScroll,
  OnbSub,
  OnbTopBar,
} from "@/components/onboarding/OnboardingUi"
import { useFinishOnboarding } from "@/components/onboarding/useFinishOnboarding"
import { RevealClock, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { hasAnything, wordsToReview, type BackCounts } from "@/lib/onboarding/backSummary"
import { firstNameFor } from "@/lib/onboarding/flow"
import { useAuthStore } from "@/stores/authStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { useLearnStore } from "@/stores/learnStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/** The numbers of the board's example (Для-Дады/онбординг-v2), shown in the web preview only. */
const PREVIEW: BackCounts = { saved: 12, playlists: 3, words: 24 }

/**
 * "Your songs are back": the end of the "I have an account" path. It counts what the account brought back
 * (saved songs and Kiirtans, playlists, words to review) and leads to the Kiirtan tab. It has no back round: the
 * person is signed in, there is nothing to undo. With nothing saved yet it says so in one plain sentence.
 */
export default function OnboardingBackScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const resolved = useResolvedAppearance()
  const openedAt = useRevealClock()
  const finish = useFinishOnboarding()

  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const savedSongs = usePreferencesStore((s) => s.savedSongIds.length)
  const savedKiirtans = useKirtanStore((s) => s.savedIds.length)
  const playlists = usePlaylistStore((s) => s.playlists.length)
  const cards = useLearnStore((s) => s.cards)

  const counts: BackCounts = MOCKUP_DATA
    ? PREVIEW
    : { saved: savedSongs + savedKiirtans, playlists, words: wordsToReview(cards, Date.now()) }
  const name = MOCKUP_DATA ? "Dada" : firstNameFor(displayName, mode)
  const lead = !hasAnything(counts) ? t("onb.back.leadEmpty") : name ? t("onb.back.lead", { name }) : t("onb.back.leadNoName")

  const rows: readonly [string, number][] = [
    [t("onb.back.saved"), counts.saved],
    [t("onb.back.playlists"), counts.playlists],
    [t("onb.back.words"), counts.words],
  ]

  return (
    <RevealClock.Provider value={openedAt}>
      <OnbPage theme={theme}>
        <StatusBar style={statusBarStyleFor(resolved)} />
        <OnbTopBar theme={theme} step={0} hideBack />
        <OnbScroll>
          <OnbReveal index={0}>
            <OnbEyebrow theme={theme}>{t("onb.back.eyebrow")}</OnbEyebrow>
            <OnbHeading theme={theme} first={t("onb.back.h1")} second={t("onb.back.h2")} />
            <OnbSub theme={theme}>{lead}</OnbSub>
          </OnbReveal>
          {hasAnything(counts) ? (
            <OnbReveal index={1}>
              <OnbGroup theme={theme} style={styles.group}>
                {rows.map(([label, value], index) => (
                  <View
                    key={label}
                    style={[styles.row, index < rows.length - 1 ? { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}
                  >
                    <Text style={[styles.label, { color: theme.textHeading }]}>{label}</Text>
                    <Text style={[styles.value, { color: theme.textHeading }]}>{value}</Text>
                  </View>
                ))}
              </OnbGroup>
            </OnbReveal>
          ) : null}
          <OnbReveal index={2}>
            <OnbNote theme={theme} style={styles.note}>
              {t("onb.back.next")}
            </OnbNote>
          </OnbReveal>
          <View style={styles.grow} />
          <OnbReveal index={3}>
            <OnbButton theme={theme} label={t("onb.continue")} onPress={finish} />
          </OnbReveal>
        </OnbScroll>
      </OnbPage>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: 24 },
  note: { marginTop: 16 },
  grow: { flex: 1, minHeight: 24 },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { flex: 1, fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  value: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.48 },
})
