import { StyleSheet, Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { DraftEntry } from "@/lib/songChords/drafts"
import type { ChordProposal } from "@/lib/songChords/types"

import { ageLabel } from "./ageLabel"
import { ActionButton, CORNER, Hint, Label, PILL } from "./parts"

/**
 * The panels of the "offer chords" screen that are not the editor: coming back to unfinished work, the banner of a
 * chart being fixed, and the confirmation after sending. The words are in locales/chordProposals.ts.
 */

/** Opening the screen with unfinished work waiting: continue it, start it over (after a confirmation) or begin a new chart. */
export function ResumePanel({
  theme,
  entries,
  onContinue,
  onStartOver,
  onFresh,
}: {
  theme: SongsTheme
  entries: DraftEntry[]
  onContinue: (entry: DraftEntry) => void
  onStartOver: (entry: DraftEntry) => void
  onFresh: () => void
}) {
  const t = useT()
  const now = Date.now()
  return (
    <View style={s.stack} accessibilityLiveRegion="polite">
      <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
        {t("chordOffer.resume.title")}
      </Text>
      <Hint theme={theme}>{t("chordOffer.resume.body")}</Hint>
      {entries.map((e) => {
        const d = e.draft
        const kind = d.editId ? ` · ${t("chordOffer.title.fix")}` : d.basedOn ? ` · ${t("chordOffer.title.copy")}` : ""
        return (
          <View key={e.key} style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[s.cardTitle, { color: theme.textHeading }]} numberOfLines={1}>
              {(d.songId ? t("chordOffer.song", { number: d.songId }) : t("upload.drafts.noSong")) + kind}
            </Text>
            <Text style={[s.cardMeta, { color: theme.textBody }]}>
              {t(`chordOffer.instrument.${d.instrument}` as "chordOffer.instrument.guitar")} · {t("chordOffer.chords.count", { count: e.chords })}
            </Text>
            <Text style={[s.cardMeta, { color: theme.textMuted }]}>{t("chordOffer.resume.saved", { when: ageLabel(t, e.updatedAt, now) })}</Text>
            <View style={s.buttons}>
              <ActionButton theme={theme} label={t("chordOffer.resume.continue")} onPress={() => onContinue(e)} style={s.half} />
              <ActionButton theme={theme} tone="quiet" label={t("chordOffer.resume.startOver")} onPress={() => onStartOver(e)} style={s.half} />
            </View>
          </View>
        )
      })}
      <ActionButton theme={theme} tone="quiet" label={t("chordOffer.resume.fresh")} onPress={onFresh} />
    </View>
  )
}

/** What is going on while a chart is fixed or copied: why it came back, or what happens when it is sent. */
export function EditBanner({ theme, mode, proposal }: { theme: SongsTheme; mode: "edit" | "copy"; proposal: ChordProposal }) {
  const t = useT()
  const rejected = mode === "edit" && proposal.status === "rejected"
  return (
    <View style={[s.banner, { borderColor: rejected ? theme.dangerText : theme.line, backgroundColor: theme.card }]} accessibilityLiveRegion="polite">
      {rejected ? (
        <>
          <Text style={[s.bannerTitle, { color: theme.dangerText }]}>{t("chordOffer.edit.rejected.title")}</Text>
          {proposal.rejectedReason ? <Text style={[s.bannerReason, { color: theme.textHeading }]}>{t("chordOffer.rejectedWhy", { reason: proposal.rejectedReason })}</Text> : null}
          <Hint theme={theme}>{t("chordOffer.edit.rejected.help")}</Hint>
        </>
      ) : (
        <Hint theme={theme}>{mode === "copy" ? t("chordOffer.edit.copy") : t("chordOffer.edit.pending")}</Hint>
      )}
      <Hint theme={theme}>{t("chordOffer.edit.locked")}</Hint>
    </View>
  )
}

function Step({ theme, n, title, body }: { theme: SongsTheme; n: number; title: string; body: string }) {
  return (
    <View style={s.step}>
      <View style={[s.stepNo, { backgroundColor: theme.peach }]}>
        <Text style={[s.stepNoText, { color: theme.accent }]}>{n}</Text>
      </View>
      <View style={s.stepText}>
        <Text style={[s.stepTitle, { color: theme.textHeading }]}>{title}</Text>
        <Text style={[s.stepBody, { color: theme.textBody }]}>{body}</Text>
      </View>
    </View>
  )
}

/**
 * After Send: the chart is with the team (or already live, for the team itself). It says what happens next, in three
 * steps, and gives the three ways on: back to Upload (where the chart now shows as "Waiting for the team"), the song,
 * and another chart.
 */
export function SentPanel({
  theme,
  proposal,
  again,
  name,
  onOpenSong,
  onAnother,
  onHub,
}: {
  theme: SongsTheme
  proposal: ChordProposal
  again: boolean
  name: string
  onOpenSong: () => void
  onAnother: () => void
  onHub: () => void
}) {
  const t = useT()
  const live = proposal.status === "published"
  const credit = proposal.isAnonymous ? t("chordOffer.sent.step3.anonymous") : name ? t("chordOffer.sent.step3.named", { name }) : t("chordOffer.sent.step3.namedNoName")
  return (
    <View style={s.stack} accessibilityLiveRegion="polite">
      <View style={[s.seal, { backgroundColor: theme.oliveBg }]}>
        <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={theme.oliveText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
        {live ? t("chordOffer.sent.title.published") : again ? t("chordOffer.sent.title.again") : t("chordOffer.sent.title")}
      </Text>
      <Label theme={theme}>{t("chordOffer.sent.lead")}</Label>
      {live ? (
        <Hint theme={theme}>{t("chordOffer.sent.published")}</Hint>
      ) : (
        <View style={s.steps}>
          <Step theme={theme} n={1} title={t("chordOffer.sent.step1.title")} body={t("chordOffer.sent.step1.body")} />
          <Step theme={theme} n={2} title={t("chordOffer.sent.step2.title")} body={t("chordOffer.sent.step2.body")} />
          <Step theme={theme} n={3} title={t("chordOffer.sent.step3.title")} body={credit} />
        </View>
      )}
      <ActionButton theme={theme} label={t("chordOffer.sent.hub")} onPress={onHub} />
      {live ? <ActionButton theme={theme} tone="quiet" label={t("chordOffer.sent.open")} onPress={onOpenSong} /> : null}
      <ActionButton theme={theme} tone="quiet" label={t("chordOffer.sent.again")} onPress={onAnother} />
    </View>
  )
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  h2: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.3, textTransform: "uppercase" },
  card: { borderWidth: 1.5, borderRadius: 24, padding: 16, gap: 4 },
  cardTitle: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  cardMeta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 12 },
  half: { flex: 1 },
  banner: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  bannerTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  bannerReason: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 21 },
  seal: { width: 64, height: 64, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
  steps: { gap: 16, marginVertical: 12 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNo: { width: 32, height: 32, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
  stepNoText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  stepText: { flex: 1, minWidth: 0, gap: 2 },
  stepTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  stepBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
