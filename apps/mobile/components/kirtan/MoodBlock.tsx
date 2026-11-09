import { useEffect, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { TagRail } from "@/components/kirtan/TagRail"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useRecordingMoods } from "@/hooks/useRecordingMoods"
import { useT } from "@/lib/i18n"
import { moodLabel } from "@/lib/kirtan/moods"
import type { Kirtan } from "@/lib/kirtan/types"
import { apiIdOf } from "@/lib/recordingExtras/links"
import { openMoods, orderedMoods, proposedMoods, UPLOADER_MOODS_MAX, waitingLine } from "@/lib/recordingMoods/rules"
import type { MoodState } from "@/lib/recordingMoods/types"

/**
 * The mood of a recording, decided by people (docs/search-menu.md, section 6). The person who added it picks one or two moods
 * (or says they are not sure); everybody else, after listening, says "fits" or "does not fit" about the moods that were
 * proposed, or starts one that fits. Enough "fits" confirm a mood and only then does Search use it. The server decides who may
 * vote and why not; this block shows its reason in one sentence and never hides the block because of it.
 */
export function MoodBlock({ theme, kirtan, collapsible, leading }: { theme: SongsTheme; kirtan: Kirtan; /** a menu: one pill that opens the block, instead of the whole card always on the page (the Kiirtan page) */ collapsible?: boolean; /** what sits at the left of the pill on the same row (the Play button) */ leading?: ReactNode }) {
  const t = useT()
  const controller = useRecordingMoods(apiIdOf(kirtan))
  const { page, busy, failure } = controller
  const [picked, setPicked] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const suggestedKey = (page?.moods ?? []).filter((m) => m.source === "uploader" && m.status !== "none").map((m) => m.mood).join(",")
  useEffect(() => setPicked(suggestedKey ? suggestedKey.split(",") : []), [suggestedKey])
  if (!page && collapsible) return leading ? <View style={s.menuRow}>{leading}</View> : null
  if (!page) return failure ? <Text style={[s.note, s.pad, { color: theme.textBody }]} accessibilityRole="alert">{t(`recMoods.failure.${failure === "too_many" ? "tooMany" : failure}` as "recMoods.failure.failed")}</Text> : null

  const toggle = (mood: string) => {
    setSaved(false)
    setPicked((now) => (now.includes(mood) ? now.filter((m) => m !== mood) : now.length >= UPLOADER_MOODS_MAX ? [...now.slice(1), mood] : [...now, mood]))
  }
  const save = async (moods: string[]) => setSaved(await controller.suggest(moods))
  const proposed = proposedMoods(page)
  const confirmed = page.moods.filter((m) => m.status === "confirmed").map((m) => moodLabel(m.mood))
  const lead = page.canSuggest ? "recMoods.lead.uploader" : page.cannotVoteBecause === "sign_in" ? "recMoods.lead.guest" : "recMoods.lead.listener"

  const card = (
    <View style={[s.card, collapsible ? s.cardMenu : null, { backgroundColor: theme.card, borderColor: theme.line }]} testID="mood-block">
      {collapsible ? null : (
        <Text style={[s.title, { color: theme.textHeading }]} accessibilityRole="header">
          {t("recMoods.title")}
        </Text>
      )}
      <Text style={[s.body, { color: theme.textBody }]}>{t(lead)}</Text>

      {page.canSuggest ? (
        <>
          <View style={s.chips}>
            {orderedMoods(page).map((m) => (
              <Chip key={m.mood} theme={theme} label={moodLabel(m.mood)} on={picked.includes(m.mood)} onPress={() => toggle(m.mood)} testID={`mood-pick-${m.mood}`} />
            ))}
          </View>
          <Text style={[s.note, { color: theme.textMuted }]}>{t("recMoods.pick.note")}</Text>
          <View style={s.row}>
            <Action theme={theme} tone="quiet" label={t("recMoods.sure")} disabled={busy} onPress={() => void save([])} />
            <Action theme={theme} label={t("recMoods.save")} disabled={busy || !picked.length} onPress={() => void save(picked)} />
          </View>
          {saved ? <Text style={[s.note, { color: theme.textHeading }]} accessibilityLiveRegion="polite">{t("recMoods.saved")}</Text> : null}
        </>
      ) : null}

      {proposed.length ? (
        <View style={s.list}>
          {proposed.map((m) => (
            <MoodRow key={m.mood} theme={theme} state={m} needed={page.needed} canVote={page.canVote} busy={busy} onVote={(value) => void controller.vote(m.mood, value)} />
          ))}
        </View>
      ) : !page.canSuggest ? (
        <Text style={[s.note, { color: theme.textMuted }]}>{t("recMoods.empty")}</Text>
      ) : null}

      {page.canVote && openMoods(page).length ? (
        <View style={s.other}>
          <Text style={[s.sub, { color: theme.textHeading }]}>{t("recMoods.other.title")}</Text>
          <TagRail
            title={t("recMoods.other.title")}
            size="large"
            look={{ bg: "transparent", border: theme.line, text: theme.textHeading }}
            testID="mood-other-rail"
            chips={openMoods(page).map((m) => ({ key: m.mood, label: moodLabel(m.mood), a11y: t("recMoods.other.a11y", { mood: moodLabel(m.mood) }), onPress: () => void controller.vote(m.mood, "yes"), testID: `mood-start-${m.mood}` }))}
          />
        </View>
      ) : null}

      {!page.canVote && !page.canSuggest && page.cannotVoteBecause ? <Text style={[s.note, { color: theme.textBody }]}>{t(`recMoods.cannot.${page.cannotVoteBecause}` as "recMoods.cannot.own")}</Text> : null}
      {failure ? (
        <Text style={[s.note, { color: theme.dangerText }]} accessibilityRole="alert">
          {t(`recMoods.failure.${failure === "too_many" ? "tooMany" : failure}` as "recMoods.failure.failed")}
        </Text>
      ) : null}
    </View>
  )
  if (!collapsible) return card
  // the menu: a pill on the row of `leading`, the block opens under it
  return (
    <View style={s.menu}>
      <View style={s.menuRow}>
        {leading}
        <KPress
          accessibilityRole="button"
          accessibilityLabel={t("kPage.mood.toggle")}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          pressedScale={0.97}
          outerStyle={s.menuPill}
          style={[s.pill, { borderColor: open ? theme.accent : theme.line, backgroundColor: open ? theme.card : "transparent" }]}
          testID="mood-menu"
        >
          <View style={s.pillText}>
            <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={1}>
              {t("recMoods.title")}
            </Text>
            {confirmed.length ? (
              <Text style={[s.note, { color: theme.textMuted }]} numberOfLines={1}>
                {confirmed.join(", ")}
              </Text>
            ) : null}
          </View>
          <Text style={[s.chevron, { color: theme.textHeading }]} accessibilityElementsHidden importantForAccessibility="no">
            {open ? "▴" : "▾"}
          </Text>
        </KPress>
      </View>
      {open ? card : null}
    </View>
  )
}

function MoodRow({ theme, state, needed, canVote, busy, onVote }: { theme: SongsTheme; state: MoodState; needed: { uploader: number; listeners: number }; canVote: boolean; busy: boolean; onVote: (value: "yes" | "no" | "clear") => void }) {
  const t = useT()
  const label = moodLabel(state.mood)
  const waiting = waitingLine(state, needed)
  return (
    <View style={[s.item, { borderColor: state.status === "confirmed" ? theme.accent : theme.line, backgroundColor: theme.page }]} testID={`mood-row-${state.mood}`}>
      <View style={s.itemHead}>
        <Text style={[s.mood, { color: theme.textHeading }]}>{label}</Text>
        <Text style={[s.status, { color: state.status === "confirmed" ? theme.accent : theme.textBody, borderColor: state.status === "confirmed" ? theme.accent : theme.line }]}>
          {state.status === "confirmed" ? t("recMoods.status.confirmed") : t("recMoods.status.waiting", { yes: String(waiting.yes), needed: String(waiting.needed) })}
        </Text>
      </View>
      {canVote ? (
        <View style={s.row}>
          <Action theme={theme} tone={state.mine === "yes" ? "primary" : "quiet"} label={t("recMoods.fits")} a11y={t("recMoods.fitsA11y", { mood: label })} disabled={busy} onPress={() => onVote(state.mine === "yes" ? "clear" : "yes")} selected={state.mine === "yes"} />
          <Action theme={theme} tone={state.mine === "no" ? "primary" : "quiet"} label={t("recMoods.notFit")} a11y={t("recMoods.notFitA11y", { mood: label })} disabled={busy} onPress={() => onVote(state.mine === "no" ? "clear" : "no")} selected={state.mine === "no"} />
        </View>
      ) : null}
      {state.mine ? <Text style={[s.note, { color: theme.textMuted }]}>{t(state.mine === "yes" ? "recMoods.mine.yes" : "recMoods.mine.no")}</Text> : null}
    </View>
  )
}

function Chip({ theme, label, on, onPress, a11y, testID }: { theme: SongsTheme; label: string; on: boolean; onPress: () => void; a11y?: string; testID?: string }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ selected: on }} onPress={onPress} pressedScale={0.95} style={[s.chip, { backgroundColor: on ? theme.accent : "transparent", borderColor: on ? theme.accent : theme.line }]} testID={testID}>
      <Text style={[s.chipText, { color: on ? theme.page : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

function Action({ theme, label, onPress, tone = "primary", disabled, selected, a11y }: { theme: SongsTheme; label: string; onPress: () => void; tone?: "primary" | "quiet"; disabled?: boolean; selected?: boolean; a11y?: string }) {
  const primary = tone === "primary"
  return (
    <KPress accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }} onPress={disabled ? undefined : onPress} pressedScale={0.97} outerStyle={s.half} style={[s.action, { backgroundColor: primary ? theme.accent : "transparent", borderColor: primary ? theme.accent : theme.line, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[s.actionText, { color: primary ? theme.page : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12, marginHorizontal: 16 },
  cardMenu: { marginHorizontal: 0 },
  menu: { gap: 12 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuPill: { flex: 1, minWidth: 0 },
  pill: { minHeight: 48, borderRadius: 70, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pillText: { flex: 1, minWidth: 0 },
  chevron: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  pad: { paddingHorizontal: 20 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  sub: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  action: { minHeight: 44, paddingHorizontal: 12, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  list: { gap: 12 },
  item: { borderRadius: 18, borderWidth: 1.5, padding: 12, gap: 8 },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  mood: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  status: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, borderWidth: 1, borderRadius: 70, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  other: { gap: 8 },
})
