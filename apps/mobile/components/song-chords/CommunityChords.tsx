import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpChordTokens, SpKeyRow } from "@/components/song-v2/SpSections"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import { Eyebrow } from "@/components/song-page/ui"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useCommunityChords } from "@/hooks/useCommunityChords"
import { useT } from "@/lib/i18n"
import { chartTokens } from "@/components/song-chords/ChartPreview"
import { chartOf, type ChordFailure, type ChordProposal, type ChordReportReason } from "@/lib/songChords/types"
import { SP_NOTES, capoName, guitarKeyNote, harmoniumKeyNote, keyLabel, keyPitch, uniqueChords } from "@/lib/songPage/spChords"
import { clampCapo } from "@/lib/songPage/chords"
import { href } from "@/utils/href"

const REASONS: readonly ChordReportReason[] = ["wrong_chords", "offensive", "spam", "other"]

function nextNote(key: string, direction: 1 | -1): string {
  return SP_NOTES[(keyPitch(key) + direction + 12) % 12]
}

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

  // capo (guitar) and Sa (harmonium) start where the author played; moving them is the reader's own, local
  const [capo, setCapo] = useState(0)
  const [sa, setSa] = useState("C")
  useEffect(() => {
    if (!current) return
    setCapo(current.capo)
    setSa(current.baseKey)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [reporting, setReporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    setReporting(false)
    setConfirmDelete(false)
    setMessage(null)
  }, [current?.id])

  const tokens = useMemo(
    () => (current && romanLines.length ? chartTokens({ romanLines, chart: chartOf(current), instrument: current.instrument, capo, harmoniumKey: sa }) : []),
    [current, romanLines, capo, sa],
  )

  const instrumentWord = { guitar: tr("chordOffer.instrument.guitar"), harmonium: tr("chordOffer.instrument.harmonium") }
  const failureText = (f: ChordFailure) => tr(`chordOffer.failure.${f}` as "chordOffer.failure.server")
  const offerHref = href(`/upload-chords?song=${songNumber}`)

  // nothing to show and nothing wrong: only the invitation
  const sounding = current ? uniqueChords(current.lines.flatMap((l) => l.placements.map((p) => p.chord))) : []
  const guitar = current?.instrument === "guitar"

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
            <Text style={[s.note, { color: t.ink500 }]}>
              {current.instrument === "guitar"
                ? current.capo > 0
                  ? tr("chordOffer.meta.guitar", { capo: current.capo, key: keyLabel(current.baseKey) })
                  : tr("chordOffer.meta.guitarNoCapo", { key: keyLabel(current.baseKey) })
                : tr("chordOffer.meta.harmonium", { key: keyLabel(current.baseKey) })}
            </Text>
            {current.status === "pending" ? <Text style={[s.pending, { color: t.accentText }]}>{tr("chordSong.pending")}</Text> : null}
            {current.status === "rejected" ? <Text style={[s.pending, { color: t.danger }]}>{tr("chordOffer.status.rejected")}</Text> : null}
          </View>

          <View style={s.pad}>
            {guitar ? (
              <SpKeyRow
                t={t}
                label={tr("chordSong.capo.label")}
                noteText={guitarKeyNote(sounding, capo)}
                value={capoName(capo)}
                onDown={() => setCapo((c) => clampCapo(c - 1))}
                onUp={() => setCapo((c) => clampCapo(c + 1))}
                downLabel={tr("chordOffer.capo.lower")}
                upLabel={tr("chordOffer.capo.raise")}
              />
            ) : (
              <SpKeyRow
                t={t}
                label={tr("chordOffer.key.harmonium.label")}
                noteText={harmoniumKeyNote(sa)}
                value={keyLabel(sa)}
                onDown={() => setSa((k) => nextNote(k, -1))}
                onUp={() => setSa((k) => nextNote(k, 1))}
                downLabel={tr("chordOffer.capo.lower")}
                upLabel={tr("chordOffer.capo.raise")}
              />
            )}
            <Text style={[s.note, { color: t.ink500 }]}>
              {guitar ? tr("chordSong.capoShown", { capo: current.capo }) : tr("chordSong.keyShown", { key: keyLabel(current.baseKey) })}
            </Text>
          </View>

          {tokens.length ? (
            <View style={s.pad}>
              {current.instrument === "guitar" && current.strum ? <Text style={[s.note, { color: t.ink500 }]}>{current.strum}</Text> : null}
              <SpChordTokens t={t} tokens={tokens} wordFont={wordFont} />
            </View>
          ) : null}

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
                  <Text style={[s.note, { color: t.ink800, flex: 1 }]}>{tr("chordOffer.delete.ask")}</Text>
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
