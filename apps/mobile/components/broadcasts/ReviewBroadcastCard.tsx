import { useState } from "react"
import { Linking, StyleSheet, Text, TextInput, View } from "react-native"

import { MONO } from "@/components/recording-extras/ui"
import { ActionButton, CORNER, Hint } from "@/components/song-chords/parts"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { actionsFor, newSinceKeep, reasonOk, reasonsSorted, REASON_MAX, stateKey, type ReviewAction } from "@/lib/broadcastReview/rules"
import type { Decision, ReviewedBroadcast, ReviewWhich, Suggestion } from "@/lib/broadcastReview/types"
import { addressToOpen } from "@/lib/broadcasts/rules"
import { whenLine } from "@/lib/broadcasts/when"
import { formatDate, useLanguage, useT } from "@/lib/i18n"

/**
 * The one place the desk opens a link outside the app: the stored address is parsed again and only one that comes back
 * unchanged leaves the app, and only because the team member tapped "Open". The desk never embeds or fetches a link.
 */
async function openOutside(url: string): Promise<boolean> {
  const address = addressToOpen(url)
  if (!address) return false
  try {
    await Linking.openURL(address)
    return true
  } catch {
    return false
  }
}

/**
 * One broadcast on the team's desk: the title and where it stands, the link AS TEXT with an Open button (never played here),
 * what the reports say (how many people, how many were anonymous and did not count, the reasons, the notes), then Keep, Hide
 * or Remove. Hide and Remove ask for a reason first: the author reads it in their notifications. `onAct` does the call and
 * returns a sentence about a problem, or null.
 */
export function ReviewBroadcastCard({ item, which, onAct }: { item: ReviewedBroadcast; which: ReviewWhich; onAct: (item: ReviewedBroadcast, action: ReviewAction, reason?: string) => Promise<string | null> }) {
  const t = useT()
  const language = useLanguage()
  const theme = useSongsTheme()
  const [asking, setAsking] = useState<"hide" | "remove" | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<ReviewAction | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const run = async (action: ReviewAction, why?: string) => {
    setBusy(action)
    setProblem(null)
    const failed = await onAct(item, action, why)
    setBusy(null)
    if (failed) setProblem(failed)
  }
  const open = async () => {
    if (!(await openOutside(item.url))) setProblem(t("bc.p.open.fail"))
  }
  const sayReason = (key: string) => (t as (k: string) => string)(`bc.r.${key}`)
  const reasons = reasonsSorted(item.reports.byReason)
  const fresh = newSinceKeep(item)
  const actions = actionsFor(which, item)
  const short = !reasonOk(reason)

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="broadcast-review-item">
      <View style={s.head}>
        <Text style={[s.title, { color: theme.textHeading }]}>{item.title}</Text>
        <View style={[s.state, { borderColor: item.state === "auto_hidden" ? amColors.danger : theme.line }]} accessible accessibilityLabel={t(stateKey(item.state))}>
          <Text style={[s.stateText, { color: item.state === "auto_hidden" ? theme.dangerText : theme.textBody }]}>{t(stateKey(item.state))}</Text>
        </View>
      </View>
      <Text style={[s.meta, { color: theme.textBody }]}>{whenLine(item, t as never, language)}</Text>
      {item.organizer ? <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.p.by", { name: item.organizer })}</Text> : null}

      <View style={[s.link, { backgroundColor: theme.page, borderColor: theme.line }]}>
        <Text selectable style={[s.url, { color: theme.textHeading }]} accessibilityLabel={t("bc.rv.link")}>
          {item.url}
        </Text>
      </View>
      <Hint theme={theme}>{t("bc.rv.link.note")}</Hint>
      <ActionButton theme={theme} tone="quiet" label={`${t("bc.p.open")} · ${item.host}`} onPress={() => void open()} />

      {item.reports.open > 0 || item.reports.cleared > 0 ? (
        <View style={s.block}>
          <Text style={[s.heading, { color: theme.textHeading }]}>{t("bc.rv.reports", { count: item.reports.open })}</Text>
          {item.reports.open > 0 ? <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.rv.counted", { counted: item.reports.counted, anonymous: item.reports.anonymous })}</Text> : null}
          {reasons.length ? <Text style={[s.meta, { color: theme.textBody }]}>{reasons.map(([key, count]) => `${sayReason(key)}: ${count}`).join(" · ")}</Text> : null}
          {item.reports.notes.map((note) => (
            <Text key={note} style={[s.note, { color: theme.textBody, borderLeftColor: theme.line }]}>
              {note}
            </Text>
          ))}
        </View>
      ) : null}
      {item.reviewedAt ? (
        <Text style={[s.meta, { color: theme.textBody }]}>
          {t("bc.rv.kept", { who: item.reviewedBy ?? "", date: formatDate(item.reviewedAt, "medium"), count: item.reviewedReports })}
          {fresh > 0 ? `  ${t("bc.rv.newSince", { count: fresh })}` : ""}
        </Text>
      ) : null}
      {item.hiddenAt ? <Text style={[s.meta, { color: theme.textBody }]}>{item.hiddenBy === "reports" ? t("bc.rv.hiddenByReports") : t("bc.rv.hiddenBy", { who: item.hiddenBy ?? "", reason: item.hiddenReason ?? "" })}</Text> : null}
      {item.removedAt ? <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.rv.removedBy", { who: item.removedBy ?? "", reason: item.removedReason ?? "" })}</Text> : null}

      {asking ? (
        <View style={s.panel}>
          <Text style={[s.heading, { color: theme.textHeading }]}>{t(asking === "hide" ? "bc.rv.hide.title" : "bc.rv.remove.title")}</Text>
          <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.rv.reason.note")}</Text>
          <View style={[s.input, { backgroundColor: theme.page, borderColor: theme.line }]}>
            <TextInput value={reason} onChangeText={setReason} placeholder={t("bc.rv.reason.label")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("bc.rv.reason.label")} multiline maxLength={REASON_MAX} style={[s.inputText, { color: theme.textHeading }]} />
          </View>
          {reason.length > 0 && short ? <Hint theme={theme} tone="danger">{t("bc.rv.reason.short")}</Hint> : null}
          <View style={s.row}>
            <ActionButton theme={theme} tone="quiet" label={t("bc.r.cancel")} onPress={() => setAsking(null)} style={s.half} />
            <ActionButton theme={theme} label={t(asking === "hide" ? "bc.rv.hide.confirm" : "bc.rv.remove.confirm")} disabled={busy !== null || short} busy={busy === asking} onPress={() => void run(asking, reason)} style={s.half} />
          </View>
        </View>
      ) : actions.length ? (
        <View style={s.row}>
          {actions.map((action) =>
            action === "keep" ? (
              <ActionButton key={action} theme={theme} label={t("bc.rv.keep")} disabled={busy !== null} busy={busy === "keep"} onPress={() => void run("keep")} style={s.third} />
            ) : (
              <ActionButton key={action} theme={theme} tone="quiet" label={t(action === "hide" ? "bc.rv.hide" : "bc.rv.remove")} disabled={busy !== null} onPress={() => setAsking(action)} style={s.third} />
            ),
          )}
        </View>
      ) : null}
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}

/** A recording a member suggested: the broadcast it is for, the link as text with Open, Accept and Decline. */
export function SuggestionCard({ item, onDecide }: { item: Suggestion; onDecide: (item: Suggestion, accept: boolean) => Promise<string | null> }) {
  const t = useT()
  const theme = useSongsTheme()
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const url = item.recording.url
  const decide = async (accept: boolean) => {
    setBusy(accept ? "accept" : "reject")
    setProblem(null)
    const failed = await onDecide(item, accept)
    setBusy(null)
    if (failed) setProblem(failed)
  }
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="broadcast-suggestion">
      <Text style={[s.title, { color: theme.textHeading }]}>{item.broadcastTitle}</Text>
      <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.rv.suggested")}</Text>
      {url ? (
        <>
          <View style={[s.link, { backgroundColor: theme.page, borderColor: theme.line }]}>
            <Text selectable style={[s.url, { color: theme.textHeading }]}>
              {url}
            </Text>
          </View>
          <ActionButton theme={theme} tone="quiet" label={`${t("bc.p.open")} · ${item.recording.host ?? ""}`} onPress={() => void openOutside(url).then((ok) => !ok && setProblem(t("bc.p.open.fail")))} />
        </>
      ) : null}
      <View style={s.row}>
        <ActionButton theme={theme} tone="quiet" label={t("bc.rv.reject")} disabled={busy !== null} busy={busy === "reject"} onPress={() => void decide(false)} style={s.half} />
        <ActionButton theme={theme} label={t("bc.rv.accept")} disabled={busy !== null} busy={busy === "accept"} onPress={() => void decide(true)} style={s.half} />
      </View>
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}

/** One line of the history of verdicts. */
export function DecisionRow({ item }: { item: Decision }) {
  const t = useT()
  const theme = useSongsTheme()
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="broadcast-decision">
      <View style={s.head}>
        <Text style={[s.title, { color: theme.textHeading }]}>{t(`bc.rv.action.${item.action}` as "bc.rv.action.keep")}</Text>
        <Text style={[s.date, { color: theme.textBody }]}>{formatDate(item.createdAt, "medium")}</Text>
      </View>
      <Text style={[s.heading, { color: theme.textHeading }]}>{item.broadcastTitle}</Text>
      {item.reason ? <Text style={[s.meta, { color: theme.textBody }]}>{t("teamReview.reason", { reason: item.reason })}</Text> : null}
      <Text style={[s.meta, { color: theme.textBody }]}>{t("bc.rv.decision.by", { who: item.decidedBy, total: item.reportsTotal, counted: item.reportsCounted })}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  state: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 10, minHeight: 28, justifyContent: "center" },
  stateText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  date: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  heading: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  link: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  url: { fontFamily: MONO, fontSize: 13, lineHeight: 18 },
  block: { gap: 4, marginTop: 4 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, borderLeftWidth: 3, paddingLeft: 10, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  half: { flex: 1 },
  third: { flex: 1 },
  panel: { gap: 8, marginTop: 4 },
  input: { borderWidth: 1.5, borderRadius: CORNER, paddingHorizontal: 12, minHeight: 72 },
  inputText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, minHeight: 72, textAlignVertical: "top", outlineStyle: "none" as never },
})
