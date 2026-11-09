import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, CORNER, PILL } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { clock } from "@/lib/authors/claims"
import { authorHref } from "@/lib/authors/constants"
import { actionsFor, deskReasonKey, type DeskAction, type DeskClaim, type DeskGroup, type DeskStatus } from "@/lib/authors/desk"
import { formatDate, useT } from "@/lib/i18n"
import { href } from "@/utils/href"

/**
 * The parts of the team's claims desk (app/team-claims.tsx): one author page with its waiting requests, and one request
 * with a tick box, the recording's facts, why it came to the team and what can be done with it.
 */

const PAGE_ACTION_LABEL = { approve: "claimsDesk.page.approveAll", reject: "claimsDesk.page.rejectAll", revoke: "claimsDesk.page.revokeAll", reopen: "claimsDesk.page.reopenAll" } as const
const ACTION_LABEL = { approve: "claimsDesk.action.approve", reject: "claimsDesk.action.reject", revoke: "claimsDesk.action.revoke", reopen: "claimsDesk.action.reopen" } as const

export function DeskGroupCard({
  theme,
  group,
  status,
  selected,
  busy,
  onToggle,
  onToggleGroup,
  onDecide,
}: {
  theme: SongsTheme
  group: DeskGroup
  status: DeskStatus
  selected: ReadonlySet<string>
  busy: boolean
  onToggle: (id: string) => void
  onToggleGroup: (ids: string[], on: boolean) => void
  onDecide: (ids: string[], action: DeskAction) => void
}) {
  const t = useT()
  const router = useRouter()
  const ids = group.items.map((i) => i.id)
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
  const [first, second] = actionsFor(status)
  return (
    <View style={[s.group, { borderColor: theme.line, backgroundColor: theme.card }]} testID="desk-group">
      <View style={s.groupHead}>
        <View style={s.flex}>
          <Text style={[s.name, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header">
            {group.name}
          </Text>
          <Text style={[s.meta, { color: group.verified ? theme.accent : theme.textBody }]}>
            {t(group.verified ? "claimsDesk.page.verified" : "claimsDesk.page.draft")} · {t("claimsDesk.page.count", { count: group.items.length })}
          </Text>
        </View>
        <KPress accessibilityRole="button" accessibilityLabel={t(allOn ? "claimsDesk.select.none" : "claimsDesk.select.all")} accessibilityState={{ checked: allOn }} onPress={() => onToggleGroup(ids, !allOn)} pressedScale={0.94} style={[s.box, { borderColor: allOn ? theme.accent : theme.textMuted, backgroundColor: allOn ? theme.accent : "transparent" }]}>
          <Text style={[s.tick, { color: allOn ? theme.page : "transparent" }]}>✓</Text>
        </KPress>
      </View>
      {ids.length > 1 ? (
        <View style={s.stack}>
          {first ? <ActionButton theme={theme} label={t(PAGE_ACTION_LABEL[first], { count: ids.length })} disabled={busy} onPress={() => onDecide(ids, first)} /> : null}
          {second && second !== "reopen" ? <ActionButton theme={theme} tone="quiet" label={t(PAGE_ACTION_LABEL[second], { count: ids.length })} disabled={busy} onPress={() => onDecide(ids, second)} /> : null}
        </View>
      ) : null}
      <ActionButton theme={theme} tone="quiet" label={t("claimsDesk.page.open")} onPress={() => router.push(href(authorHref(group.slug)))} />
      <View style={s.list}>
        {group.items.map((item) => (
          <DeskRow key={item.id} theme={theme} item={item} status={status} picked={selected.has(item.id)} busy={busy} onToggle={() => onToggle(item.id)} onDecide={(action) => onDecide([item.id], action)} />
        ))}
      </View>
    </View>
  )
}

function DeskRow({ theme, item, status, picked, busy, onToggle, onDecide }: { theme: SongsTheme; item: DeskClaim; status: DeskStatus; picked: boolean; busy: boolean; onToggle: () => void; onDecide: (action: DeskAction) => void }) {
  const t = useT()
  const router = useRouter()
  const reason = item.team_reason ?? "other"
  const whyKey = `claimsDesk.why.${reason === "taken_by_other" ? "taken" : reason}` as "claimsDesk.why.other"
  const length = clock(item.recording.duration_sec)
  return (
    <View style={[s.item, { borderColor: picked ? theme.accent : theme.line, backgroundColor: theme.page }]} testID="desk-claim">
      <View style={s.groupHead}>
        <View style={s.flex}>
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
            {item.recording.title}
          </Text>
        </View>
        <KPress accessibilityRole="button" accessibilityLabel={t("claimsDesk.card.select", { title: item.recording.title })} accessibilityState={{ checked: picked }} onPress={onToggle} pressedScale={0.94} style={[s.box, { borderColor: picked ? theme.accent : theme.textMuted, backgroundColor: picked ? theme.accent : "transparent" }]}>
          <Text style={[s.tick, { color: picked ? theme.page : "transparent" }]}>✓</Text>
        </KPress>
      </View>
      <Text style={[s.meta, { color: theme.textBody }]}>{t("claimsDesk.card.credit", { credit: item.recording.author || "-" })}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>
        {item.recording.library ? t("claimsDesk.card.library") : t("claimsDesk.card.added", { name: item.recording.added_by })}
        {" · "}
        {t("claimsDesk.card.plays", { count: item.recording.plays })}
        {length ? ` · ${length}` : ""}
      </Text>
      <View style={s.pills}>
        <Text style={[s.pill, { color: theme.textHeading, borderColor: theme.line }]}>{t(deskReasonKey(reason) as "claimsDesk.reason.other")}</Text>
        <Text style={[s.pill, { color: theme.textBody, borderColor: theme.line }]}>{t(`claimsDesk.level.${item.level}` as "claimsDesk.level.same")}</Text>
      </View>
      {status === "pending" ? <Text style={[s.why, { color: theme.textBody }]}>{t(whyKey)}</Text> : null}
      <Text style={[s.meta, { color: theme.textMuted }]}>{t("claimsDesk.card.asked", { date: formatDate(item.created_at, "medium") })}</Text>
      {item.decision_note ? <Text style={[s.meta, { color: theme.textBody }]}>{t("claimsDesk.card.note", { note: item.decision_note })}</Text> : null}
      <View style={s.row}>
        {actionsFor(status).map((action, index) => (
          <ActionButton key={action} theme={theme} tone={index === 0 ? "primary" : "quiet"} label={t(ACTION_LABEL[action])} disabled={busy} onPress={() => onDecide(action)} style={s.half} />
        ))}
      </View>
      <ActionButton theme={theme} tone="quiet" label={t("claimsDesk.card.open")} onPress={() => router.push(href(`/recording/${encodeURIComponent(item.recording.id)}`))} />
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  group: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 12 },
  groupHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 26 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  why: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8 },
  stack: { gap: 8 },
  half: { flex: 1 },
  list: { gap: 12 },
  item: { borderWidth: 1.5, borderRadius: CORNER - 4, padding: 12, gap: 8 },
  box: { width: 44, height: 44, borderRadius: PILL, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tick: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, borderWidth: 1.5, borderRadius: PILL, paddingHorizontal: 12, paddingVertical: 4, overflow: "hidden" },
})
