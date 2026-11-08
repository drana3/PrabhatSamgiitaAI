import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { playPreview, stopPreview, usePreviewing } from "@/lib/kirtan/preview"
import type { RemoteBrief } from "@/lib/kirtan/remote"

/**
 * "Is this the song you want to upload?": the card of a file that looks like a recording already in the library, for every
 * kind and every way of uploading (one file, a queue row, a playlist track). It lists up to three matches; each has a small
 * Listen button (the card's own preview player, lib/kirtan/preview.ts: it does not touch the app's player, the radio or the queue,
 * and stops when the card closes or the person answers). Two answers:
 *   "Yes, this is it"       the file is not uploaded, the person is told and chooses another (the caller deletes the file on the server)
 *   "No, mine is different" the upload goes on and the pair is marked "confirmed different" for the team
 * The check compares the sound only when the server has `fpcalc`; a match with no "sound" reason says so (docs/duplicate-check.md).
 * Holds no state but a note when a file cannot be played.
 */
export function DuplicateCard({ theme, briefs, onSame, onDifferent }: { theme: SongsTheme; briefs: readonly RemoteBrief[]; onSame: () => void; onDifferent: () => void }) {
  const t = useT()
  const playing = usePreviewing()
  const [cantPlay, setCantPlay] = useState(false)
  // the preview never outlives the card: closing it (answer, remove, leaving the screen) stops the sound
  useEffect(() => () => void stopPreview(), [])
  const shown = briefs.slice(0, 3)
  const bySound = shown.some((brief) => brief.reasons?.includes("sound"))

  const listen = async (brief: RemoteBrief) => {
    setCantPlay(false)
    if (!brief.audio_url) {
      setCantPlay(true)
      return
    }
    const result = await playPreview(brief.id, brief.audio_url)
    if (result === "error") setCantPlay(true)
  }
  const answer = (go: () => void) => {
    void stopPreview()
    go()
  }

  return (
    <View style={[s.card, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityLiveRegion="polite">
      <Text style={[s.title, { color: theme.textHeading }]} accessibilityRole="header">
        {t("ugc.similar.title")}
      </Text>
      <Text style={[s.body, { color: theme.textBody }]}>{t("ugc.similar.body")}</Text>
      {shown.map((brief) => {
        const on = playing === brief.id
        const minutes = brief.duration_sec ? `${Math.floor(brief.duration_sec / 60)}:${String(Math.round(brief.duration_sec % 60)).padStart(2, "0")}` : null
        return (
          <View key={brief.id} style={s.row}>
            <View style={s.names}>
              <Text style={[s.matchTitle, { color: theme.textHeading }]} numberOfLines={2}>
                {brief.title}
              </Text>
              <Text style={[s.meta, { color: theme.textBody }]} numberOfLines={1}>
                {[brief.author, minutes].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <KPress
              accessibilityRole="button"
              accessibilityLabel={on ? t("ugc.similar.stop") : t("ugc.similar.playA11y", { title: brief.title })}
              accessibilityState={{ selected: on }}
              onPress={() => void listen(brief)}
              pressedScale={0.94}
              style={[s.listen, { backgroundColor: on ? theme.brand : theme.peach }]}
            >
              <Text style={[s.listenText, { color: on ? theme.onBrand : theme.accent }]}>{on ? t("ugc.similar.stop") : t("ugc.similar.play")}</Text>
            </KPress>
          </View>
        )
      })}
      {cantPlay ? <Text style={[s.meta, { color: theme.dangerText }]}>{t("ugc.similar.cantPlay")}</Text> : null}
      {!bySound ? <Text style={[s.meta, { color: theme.textBody }]}>{t("ugc.similar.soundNote")}</Text> : null}
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.yes")} onPress={() => answer(onSame)} pressedScale={0.98} style={[s.button, { backgroundColor: amColors.orange700 }]}>
        <Text style={s.buttonText}>{t("ugc.similar.yes")}</Text>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.no")} onPress={() => answer(onDifferent)} pressedScale={0.98} style={[s.button, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <Text style={[s.buttonText, { color: theme.textHeading }]}>{t("ugc.similar.no")}</Text>
      </KPress>
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginTop: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  names: { flex: 1, minWidth: 0, gap: 4 },
  matchTitle: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  meta: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  listen: { minHeight: 40, minWidth: 72, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  listenText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.2 },
  button: { height: 48, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  buttonText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
})
