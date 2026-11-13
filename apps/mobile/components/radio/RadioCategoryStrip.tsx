import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { Check, ChevronRight, Trophy } from "lucide-react-native"

import { Press } from "@/components/songs-v2/Press"
import { amFonts } from "@/constants/tokens/amTypography"
import { useRadioPools } from "@/hooks/useRadioPools"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT, formatNumber } from "@/lib/i18n"
import { RADIO_CATEGORIES, isAllSelected, type RadioCategory } from "@/lib/radio/categories"
import { categoryName, summaryText } from "@/lib/radio/labels"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

type Hint = "last" | "empty" | "next" | null
const HINT_MS = 3200

/**
 * What the Radio plays, as chips: Prabhat Samgiita, Kiirtan, Bhajan, Spiritual song, Dance music, Baba's Audio Discourses.
 * Every category shows how many tracks it has; one with none (count 0) cannot be chosen. At least one stays on: the last
 * tick answers with a gentle line instead of switching off. "All" ticks every category that has something to play.
 * The choice is remembered (stores/radioSelectionStore.ts) and changes the NEXT track while the Radio plays, never
 * the one playing now (lib/radio/applyChange.ts). The line under the chips says in words what is on.
 */
export function RadioCategoryStrip() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const { counts, chosen } = useRadioPools()
  const toggle = useRadioSelectionStore((s) => s.toggle)
  const chooseAll = useRadioSelectionStore((s) => s.chooseAll)
  const playing = usePlayerStore((s) => s.playbackMode === "random" && s.driveAutoAdvance && s.currentSong != null)
  const [hint, setHint] = useState<Hint>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((next: Hint) => {
    if (timer.current) clearTimeout(timer.current)
    setHint(next)
    if (next) timer.current = setTimeout(() => setHint(null), HINT_MS)
  }, [])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const onChip = (id: RadioCategory) => {
    const result = toggle(id, counts)
    if (result === "last") say("last")
    else if (result === "empty") say("empty")
    else say(playing ? "next" : null)
  }
  const onAll = () => {
    chooseAll(counts)
    say(playing ? "next" : null)
  }
  const all = isAllSelected(chosen, counts)

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={s.head}>
        <Text style={[s.title, { color: theme.textHeading }]} accessibilityRole="header">
          {t("radio.cats.title")}
        </Text>
        <Press
          accessibilityRole="button"
          accessibilityLabel={t("radio.cats.all.a11y")}
          accessibilityState={{ selected: all }}
          onPress={onAll}
          pressedScale={0.94}
          style={[s.allBtn, { borderColor: all ? theme.accent : theme.line, backgroundColor: all ? theme.peach : "transparent" }]}
        >
          <Text style={[s.allText, { color: all ? theme.accent : theme.textBody }]}>{t("radio.cats.all")}</Text>
        </Press>
      </View>

      <View style={s.chips}>
        {RADIO_CATEGORIES.map((id) => {
          const count = counts[id]
          const empty = count === 0
          const on = chosen.includes(id)
          const name = categoryName(id)
          return (
            <Press
              key={id}
              accessibilityRole="button"
              accessibilityLabel={empty ? t("radio.cats.chip.empty.a11y", { name }) : t("radio.cats.chip.a11y", { name, count })}
              accessibilityState={{ selected: on, disabled: empty }}
              onPress={() => onChip(id)}
              pressedScale={empty ? 1 : 0.95}
              style={[
                s.chip,
                { borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.peach : theme.page },
                empty && s.chipEmpty,
              ]}
            >
              {on ? <Check size={15} color={theme.accent} strokeWidth={2.4} /> : null}
              <Text style={[s.chipName, { color: on ? theme.accent : empty ? theme.textMuted : theme.textHeading }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[s.chipCount, { color: empty ? theme.textMuted : theme.textBody }]}>{formatNumber(count)}</Text>
            </Press>
          )
        })}
      </View>

      <Text style={[s.summary, { color: theme.textBody }]} accessibilityLiveRegion="polite">
        {summaryText(chosen, counts)}
      </Text>
      {hint ? (
        <Text style={[s.hint, { color: theme.accent }]} accessibilityLiveRegion="polite">
          {hint === "last" ? t("radio.cats.last") : hint === "empty" ? t("radio.cats.empty") : t("radio.cats.next")}
        </Text>
      ) : null}

      <Press
        accessibilityRole="link"
        accessibilityLabel={t("top.radio.link")}
        onPress={() => router.push(href("/top-played"))}
        pressedScale={0.98}
        style={[s.link, { borderTopColor: theme.line }]}
      >
        <Trophy size={18} color={theme.accent} strokeWidth={1.9} />
        <Text style={[s.linkText, { color: theme.textHeading }]} numberOfLines={1}>
          {t("top.radio.link")}
        </Text>
        <ChevronRight size={18} color={theme.textBody} strokeWidth={1.9} />
      </Press>
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  allBtn: { minHeight: 36, minWidth: 56, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  allText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, alignSelf: "flex-start" },
  chipEmpty: { opacity: 0.55, borderStyle: "dashed" },
  chipName: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18, flexShrink: 1 },
  chipCount: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  summary: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  hint: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  link: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  linkText: { flex: 1, fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
