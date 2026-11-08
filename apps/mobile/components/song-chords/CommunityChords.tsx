import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { ChartBody, ChartCreditLine, ChartMeta } from "@/components/song-chords/ChartBody"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import { Eyebrow } from "@/components/song-page/ui"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useCommunityChords } from "@/hooks/useCommunityChords"
import { useT } from "@/lib/i18n"
import { editHref } from "@/lib/songChords/charts"
import { type ChordFailure, type ChordReportReason } from "@/lib/songChords/types"
import { href } from "@/utils/href"

const REASONS: readonly ChordReportReason[] = ["wrong_chords", "offensive", "spam", "other"]

/**
 * Charts members offered for this song, under the song page's own chords: one chip for each chart (instrument and
 * author), the chosen chart drawn with the same pieces as the built-in one (letters over the lyrics), a capo or key
 * control that starts where the author played, who made it and what they said, and report / delete. A chart that is
 * still waiting for the team is shown to its author only (the server sends it to nobody else).
 */
export function CommunityChords({
  t,
  songNumber,
  romanLines,
  wordFont,
}: {
  t: SpTheme
  songNumber: number
  romanLines: readonly string[]
  wordFont?: string
}) {
  const tr = useT()
  const router = useRouter()
  const { status, items, remove, report } = useCommunityChords(songNumber)
  const [chosen, setChosen] = useState<string | null>(null)
  const current = items.find((p) => p.id === chosen) ?? items[0] ?? null

  const [reporting, setReporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    setReporting(false)
    setConfirmDelete(false)
    setMessage(null)
  }, [current?.id])

  const instrumentWord = { guitar: tr("chordOffer.instrument.guitar"), harmonium: tr("chordOffer.instrument.harmonium") }
  const failureText = (f: ChordFailure) => tr(`chordOffer.failure.${f}` as "chordOffer.failure.server")
  const offerHref = href(`/upload-chords?song=${songNumber}`)

  return (
    <View style={s.root}>
      <Eyebrow t={t} style={s.pad}>
        {tr("chordSong.title")}
      </Eyebrow>
      {status === "loading" && items.length === 0 ? <Text style={[s.note, s.pad, { color: t.ink500 }]}>{tr("chordSong.loading")}</Text> : null}
      {status === "error" ? <Text style={[s.note, s.pad, { color: t.ink500 }]}>{tr("chordSong.error")}</Text> : null}

      {items.length > 1 ? (
        <View style={[s.chips, s.pad]} accessibilityRole="radiogroup" accessibilityLabel={tr("chordSong.versions.a11y")}>
          {items.map((p) => {
            const on = p.id === current?.id
            const who = p.mine ? tr("chordSong.version.mine") : p.author ? p.author.name : tr("chordSong.anonymous.short")
            return (
              <SpPress
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${instrumentWord[p.instrument]}, ${who}`}
                onPress={() => setChosen(p.id)}
                style={[s.chip, { backgroundColor: on ? t.ink900 : t.white, borderColor: on ? t.ink900 : t.sand300 }]}
              >
                <Text style={[s.chipText, { color: on ? t.onInk : t.ink800 }]} numberOfLines={1}>
                  {`${instrumentWord[p.instrument]} · ${who}`}
                </Text>
              </SpPress>
            )
          })}
        </View>
      ) : null}

      {current ? (
        <View style={s.body}>
          <View style={s.pad}>
            <Text style={[s.meta, { color: t.ink900 }]}>
              {current.mine ? tr("chordSong.byYou") : current.author ? tr("chordSong.by", { name: current.author.name }) : tr("chordSong.anonymous")}
            </Text>
            {/* linked to the original when it is on this page; plain words when it is not (deleted, or another instrument's tab) */}
            <ChartCreditLine t={t} chart={current} onOpenOriginal={items.some((p) => p.id === current.basedOn?.id) ? setChosen : undefined} />
            <ChartMeta t={t} chart={current} />
            {current.status === "pending" ? <Text style={[s.pending, { color: t.accentText }]}>{tr("chordSong.pending")}</Text> : null}
            {current.status === "rejected" ? <Text style={[s.pending, { color: t.danger }]}>{tr("chordOffer.status.rejected")}</Text> : null}
            {current.mine && current.status === "rejected" && current.rejectedReason ? <Text style={[s.note, { color: t.ink800 }]}>{tr("chordOffer.rejectedWhy", { reason: current.rejectedReason })}</Text> : null}
            {!current.mine && current.status === "published" ? (
              <SpPress accessibilityLabel={tr("chordSong.startFrom")} onPress={() => router.push(href(`/upload-chords?from=${encodeURIComponent(current.id)}&song=${songNumber}`))} style={s.link}>
                <Text style={[s.linkText, { color: t.accentText }]}>{tr("chordSong.startFrom")}</Text>
              </SpPress>
            ) : null}
            {current.mine ? (
              <SpPress
                accessibilityLabel={current.status === "rejected" ? tr("upload.mine.fix") : current.status === "published" ? tr("chordSong.editCopy") : tr("chordSong.edit")}
                onPress={() => router.push(href(editHref(current)))}
                style={s.link}
              >
                <Text style={[s.linkText, { color: t.accentText }]}>
                  {current.status === "rejected" ? tr("upload.mine.fix") : current.status === "published" ? tr("chordSong.editCopy") : tr("chordSong.edit")}
                </Text>
              </SpPress>
            ) : null}
          </View>

          <ChartBody t={t} chart={current} romanLines={romanLines} wordFont={wordFont} />

          <View style={s.pad}>
            {current.playedIt ? <Text style={[s.note, { color: t.ink500 }]}>{tr("chordSong.playedIt")}</Text> : null}
            {current.note ? <Text style={[s.note, { color: t.ink800 }]}>{tr("chordSong.note", { note: current.note })}</Text> : null}
            {message ? (
              <Text style={[s.note, { color: t.ink800 }]} accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}

            {current.mine ? (
              confirmDelete ? (
                <View style={s.row}>
                  <Text style={[s.note, { color: t.ink800, flex: 1 }]}>{current.status === "published" ? tr("chordOffer.delete.ask.published") : tr("chordOffer.delete.ask")}</Text>
                  <SpPill
                    t={t}
                    variant="sand"
                    label={tr("chordOffer.delete.keep")}
                    onPress={() => setConfirmDelete(false)}
                  />
                  <SpPill
                    t={t}
                    variant="brand"
                    label={tr("chordOffer.delete.yes")}
                    onPress={() =>
                      void remove(current.id).then((f) => {
                        if (f) setMessage(failureText(f))
                        else setMessage(tr("chordOffer.deleted"))
                        setConfirmDelete(false)
                      })
                    }
                  />
                </View>
              ) : (
                <SpPress accessibilityLabel={tr("chordOffer.delete.a11y")} onPress={() => setConfirmDelete(true)} style={s.link}>
                  <Text style={[s.linkText, { color: t.accentText }]}>{tr("chordOffer.delete")}</Text>
                </SpPress>
              )
            ) : reporting ? (
              <View style={s.reasons}>
                <Text style={[s.meta, { color: t.ink900 }]}>{tr("chordSong.report.title")}</Text>
                {REASONS.map((reason) => (
                  <SpPress
                    key={reason}
                    onPress={() =>
                      void report(current.id, reason).then((result) => {
                        setReporting(false)
                        setMessage(result === "received" ? tr("chordSong.report.sent") : result === "already_reported" ? tr("chordSong.report.already") : tr("chordSong.report.failed"))
                      })
                    }
                    style={[s.reason, { backgroundColor: t.white, borderColor: t.sand300 }]}
                  >
                    <Text style={[s.chipText, { color: t.ink800 }]}>{tr(`chordSong.report.${reason}` as "chordSong.report.other")}</Text>
                  </SpPress>
                ))}
                <SpPress onPress={() => setReporting(false)} style={s.link}>
                  <Text style={[s.linkText, { color: t.accentText }]}>{tr("chordSong.report.cancel")}</Text>
                </SpPress>
              </View>
            ) : current.status === "published" ? (
              <SpPress accessibilityLabel={tr("chordSong.report")} onPress={() => setReporting(true)} style={s.link}>
                <Text style={[s.linkText, { color: t.ink500 }]}>{tr("chordSong.report")}</Text>
              </SpPress>
            ) : null}
          </View>
        </View>
      ) : status === "ready" ? (
        <Text style={[s.note, s.pad, { color: t.ink500 }]}>{tr("chordSong.offer.empty")}</Text>
      ) : null}

      <View style={[s.pad, s.row]}>
        <SpPill t={t} variant="sand" icon="plus" label={tr("chordSong.offer")} onPress={() => router.push(offerHref)} />
      </View>
      {items.some((p) => p.mine) ? (
        <View style={s.pad}>
          <SpPress accessibilityLabel={tr("chordSong.mine.link")} onPress={() => router.push(href("/upload"))} style={s.link}>
            <Text style={[s.linkText, { color: t.accentText }]}>{tr("chordSong.mine.link")}</Text>
          </SpPress>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 12, paddingTop: 20 },
  pad: { paddingHorizontal: 20, gap: 8 },
  body: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 8, marginBottom: 8 },
  chipText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  pending: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  reasons: { gap: 8 },
  reason: { minHeight: 44, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
})
