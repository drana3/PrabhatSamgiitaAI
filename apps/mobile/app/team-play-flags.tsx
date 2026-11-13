import { useCallback, useState } from "react"
import { Text, View } from "react-native"
import { useRouter } from "expo-router"

import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { DeskFrame, DeskStatus, deskStyles as d, failureText } from "@/components/team-desks/DeskFrame"
import { useDeskLoad } from "@/hooks/useDeskLoad"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, formatNumber, useT } from "@/lib/i18n"
import { teamDesks } from "@/lib/teamDesks/backend"
import { FLAG_TABS, baselineLabel, flagActions, flagKey, leftOut, localDay, recordingPath } from "@/lib/teamDesks/rules"
import type { FlagAction, FlagItem, FlagStatus } from "@/lib/teamDesks/types"
import { href } from "@/utils/href"

const NONE: FlagItem[] = []

/**
 * The team's desk for suspicious play counts (docs/play-fraud.md): days on which a recording's plays are far above its usual.
 * Each card shows counts and the rule's reason, never who played (the server keeps no listener data for this), then "real"
 * (nothing is held back), "inflated" (the plays stay out of the numbers for good) or, for a day marked inflated by mistake,
 * "take back". When nothing is flagged the screen says so and what makes a day appear. Team only; docs/team-desks.md.
 */
export default function TeamPlayFlagsScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const [tab, setTab] = useState<FlagStatus>("open")
  const [notice, setNotice] = useState<string | null>(null)
  const { status, data, reload, setData } = useDeskLoad(() => teamDesks().flags.list(tab), NONE, [tab])

  const decided = useCallback(
    (before: FlagItem, after: FlagItem, action: FlagAction) => {
      setNotice(t(`teamDesk.flags.done.${action}` as "teamDesk.flags.done.clear"))
      // the card leaves a tab it no longer belongs to; one that still belongs is replaced by the server's new state
      setData((list) => list.flatMap((i) => (flagKey(i) !== flagKey(before) ? [i] : after.status === tab ? [after] : [])))
    },
    [setData, t, tab],
  )

  return (
    <DeskFrame title={t("teamDesk.flags.title")} lead={t("teamDesk.flags.lead")}>
      <View style={d.chips} accessibilityRole="tablist" accessibilityLabel={t("teamDesk.flags.tabs.a11y")}>
        {FLAG_TABS.map((id) => (
          <Chip key={id} theme={theme} label={t(`teamDesk.flags.tab.${id}` as "teamDesk.flags.tab.open")} on={tab === id} onPress={() => setTab(id)} />
        ))}
      </View>
      {notice ? <Hint theme={theme}>{notice}</Hint> : null}
      <DeskStatus status={status} isEmpty={data.length === 0} onRetry={reload} />
      {status === "ready" && data.length === 0 ? (
        <View style={d.gap}>
          <Hint theme={theme}>{t(`teamDesk.flags.empty.${tab}` as "teamDesk.flags.empty.open")}</Hint>
          <Text style={[d.body, { color: theme.textMuted }]}>{t("teamDesk.flags.noAccounts")}</Text>
        </View>
      ) : null}
      {data.map((item) => (
        <FlagCard key={flagKey(item)} item={item} onDecided={decided} onGone={reload} />
      ))}
    </DeskFrame>
  )
}

function FlagCard({ item, onDecided, onGone }: { item: FlagItem; onDecided: (before: FlagItem, after: FlagItem, action: FlagAction) => void; onGone: () => void }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const open = recordingPath(item.recording_id)
  const decision = item.last_decision ? t(`teamDesk.flags.decision.${item.last_decision}` as "teamDesk.flags.decision.cleared") : null

  const run = async (action: FlagAction) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      onDecided(item, await teamDesks().flags.decide(item, action), action)
    } catch (error) {
      const failure = failureText(t, error)
      setProblem(failure.text)
      if (failure.gone) onGone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[d.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="flag-card">
      <Text style={[d.title, { color: theme.textHeading }]}>{item.recording_title ?? item.recording_id}</Text>
      <Text style={[d.meta, { color: theme.textMuted }]}>{t("teamDesk.flags.day", { day: formatDate(localDay(item.day) ?? item.day, "medium") })}</Text>
      <Text style={[d.meta, { color: theme.textHeading }]}>{t("teamDesk.flags.counts", { plays: formatNumber(item.plays), baseline: baselineLabel(item.baseline), held: formatNumber(item.held) })}</Text>
      <Text style={[d.meta, { color: theme.textBody }]}>{t("teamDesk.flags.leftOut", { count: formatNumber(leftOut(item)) })}</Text>
      <Text style={[d.body, { color: theme.textBody }]}>{t("teamDesk.flags.reason", { reason: item.reason })}</Text>
      {decision && item.reviewed_at ? <Text style={[d.meta, { color: theme.textMuted }]}>{t("teamDesk.flags.last", { decision, name: item.reviewed_by ?? "-", date: formatDate(item.reviewed_at, "medium") })}</Text> : null}
      {open ? <ActionButton theme={theme} tone="quiet" label={t("teamDesk.openRecording")} onPress={() => router.push(href(open))} /> : null}
      <View style={d.row}>
        {flagActions(item).map((action, index) => (
          <ActionButton key={action} theme={theme} tone={index === 0 ? "primary" : "quiet"} label={t(`teamDesk.flags.${action}` as "teamDesk.flags.clear")} disabled={busy} busy={busy && index === 0} onPress={() => void run(action)} />
        ))}
      </View>
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}
