import { useCallback, useState } from "react"
import { Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"

import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { DeskFrame, DeskStatus, deskStyles as d, failureText } from "@/components/team-desks/DeskFrame"
import { useDeskLoad } from "@/hooks/useDeskLoad"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { teamDesks } from "@/lib/teamDesks/backend"
import { NOTE_MAX, REASON_MAX, TAB_STATUSES, TAKEDOWN_TABS, needsReason, reasonProblem, recordingPath, takedownActions, type TakedownTab } from "@/lib/teamDesks/rules"
import type { TakedownAction, TakedownItem } from "@/lib/teamDesks/types"
import { href } from "@/utils/href"

type Page = { items: TakedownItem[]; total: number }
const NONE: Page = { items: [], total: 0 }

/**
 * The team's desk for takedown requests: a rights holder asks to remove a recording (docs/takedown-process.md). Four tabs
 * (waiting, taken down, waiting time, finished). Each card shows who asks, what they claim and the recording, then the
 * actions the server allows: Take down now (hides the recording, keeps the record, asks once more), Reject with a reason,
 * pass a counter-notice on, Restore, Close. Team only: the server decides. Opened from the Upload hub (docs/team-desks.md).
 */
export default function TeamTakedownsScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const [tab, setTab] = useState<TakedownTab>("waiting")
  const [notice, setNotice] = useState<string | null>(null)
  const { status, data, reload, setData } = useDeskLoad(() => teamDesks().takedowns.list(TAB_STATUSES[tab]), NONE, [tab])

  const changed = useCallback(
    (before: TakedownItem, after: TakedownItem, action: TakedownAction) => {
      setNotice(t(`teamDesk.takedown.done.${action}` as "teamDesk.takedown.done.link"))
      // a card leaves the tab it was filed under when its status moved; a link keeps it where it is
      if (action === "link") setData((page) => ({ ...page, items: page.items.map((i) => (i.id === after.id ? after : i)) }))
      else {
        setData((page) => ({ items: page.items.filter((i) => i.id !== before.id), total: Math.max(0, page.total - 1) }))
        // restoring or closing a counter-notice also moves the notice it answers
        if (after.kind === "counter_notice") reload()
      }
    },
    [reload, setData, t],
  )

  return (
    <DeskFrame title={t("teamDesk.takedown.title")} lead={t("teamDesk.takedown.lead")}>
      <View style={d.chips} accessibilityRole="tablist" accessibilityLabel={t("teamDesk.takedown.tabs.a11y")}>
        {TAKEDOWN_TABS.map((id) => (
          <Chip key={id} theme={theme} label={t(`teamDesk.takedown.tab.${id}` as "teamDesk.takedown.tab.waiting")} on={tab === id} onPress={() => setTab(id)} />
        ))}
      </View>
      {notice ? <Hint theme={theme}>{notice}</Hint> : null}
      <DeskStatus status={status} isEmpty={data.items.length === 0} onRetry={reload} />
      {status === "ready" && data.items.length === 0 ? <Hint theme={theme}>{t(`teamDesk.takedown.empty.${tab}` as "teamDesk.takedown.empty.waiting")}</Hint> : null}
      {data.items.map((item) => (
        <RequestCard key={item.id} item={item} onChanged={changed} onGone={reload} />
      ))}
    </DeskFrame>
  )
}

type Step = null | "takeDown" | "reject" | "close"

function RequestCard({ item, onChanged, onGone }: { item: TakedownItem; onChanged: (before: TakedownItem, after: TakedownItem, action: TakedownAction) => void; onGone: () => void }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const [step, setStep] = useState<Step>(null)
  const [text, setText] = useState("")
  const [address, setAddress] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const actions = takedownActions(item)
  const open = recordingPath(item.recording_id)
  const isCounter = item.kind === "counter_notice"
  const reasonShort = text.length > 0 && reasonProblem(text) !== null

  const run = async (action: TakedownAction, work: () => Promise<TakedownItem>) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const after = await work()
      setStep(null)
      setText("")
      onChanged(item, after, action)
    } catch (error) {
      const failure = failureText(t, error, { keepOn404: action === "link" })
      setProblem(failure.text)
      if (failure.gone) onGone()
    } finally {
      setBusy(false)
    }
  }

  const api = teamDesks().takedowns
  const start = (action: TakedownAction) => {
    setProblem(null)
    setText("")
    if (action === "takeDown" || action === "reject" || action === "close") setStep(action)
    else if (action === "forward") void run(action, () => api.forward(item.id))
    else if (action === "restore") void run(action, () => api.restore(item.id, false))
    else if (action === "restoreWithdrawn") void run(action, () => api.restore(item.id, true))
  }
  const send = () => {
    if (step === "takeDown") void run("takeDown", () => api.takeDown(item.id, text))
    else if (step === "reject") void run("reject", () => api.reject(item.id, text))
    else if (step === "close") void run("close", () => api.close(item.id, text))
  }

  const sender = item.sender_org ? t("teamDesk.takedown.fromOrg", { name: item.sender_name, org: item.sender_org }) : t("teamDesk.takedown.from", { name: item.sender_name })
  const claim = [item.work_description, item.claim_description].filter(Boolean)
  const stepNeedsReason = step !== null && step !== "takeDown" && needsReason(step)

  return (
    <View style={[d.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="takedown-card">
      <Text style={[d.pill, { color: theme.textHeading, borderColor: theme.line }]}>{t(`teamDesk.takedown.status.${item.status}` as "teamDesk.takedown.status.new")}</Text>
      <Text style={[d.title, { color: theme.textHeading }]}>{t(`teamDesk.takedown.kind.${item.kind}` as "teamDesk.takedown.kind.notice")}</Text>
      <Text style={[d.meta, { color: theme.textMuted }]}>
        {t("teamDesk.takedown.reference", { reference: item.reference })}
        {" · "}
        {t("teamDesk.takedown.received", { date: formatDate(item.created_at, "medium") })}
      </Text>
      <Text style={[d.meta, { color: theme.textHeading }]}>{sender}</Text>
      <Text style={[d.meta, { color: theme.textBody }]} selectable>
        {t("teamDesk.takedown.email", { email: item.sender_email })}
      </Text>
      <Text style={[d.meta, { color: theme.textHeading }]}>
        {item.recording_id ? t("teamDesk.takedown.recording", { title: item.recording_title ?? item.recording_ref }) : t("teamDesk.takedown.recording.unknown", { ref: item.recording_ref })}
      </Text>
      {claim.length > 0 ? (
        <View style={d.gap}>
          <Text style={[d.meta, { color: theme.textMuted }]}>{t(isCounter ? "teamDesk.takedown.counter.why" : "teamDesk.takedown.work")}</Text>
          {claim.map((line, index) => (
            <Text key={index} style={[d.body, { color: theme.textBody }]} selectable>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {item.decision_reason ? <Text style={[d.body, { color: theme.textBody }]}>{t("teamDesk.takedown.decision", { reason: item.decision_reason })}</Text> : null}
      {item.decided_by && item.decided_at ? <Text style={[d.meta, { color: theme.textMuted }]}>{t("teamDesk.takedown.decidedBy", { name: item.decided_by, date: formatDate(item.decided_at, "medium") })}</Text> : null}
      {item.waiting_until ? <Text style={[d.meta, { color: theme.textMuted }]}>{t("teamDesk.takedown.waitUntil", { date: formatDate(item.waiting_until, "medium") })}</Text> : null}

      {open ? <ActionButton theme={theme} tone="quiet" label={t("teamDesk.openRecording")} onPress={() => router.push(href(open))} /> : null}

      {actions.includes("link") && step === null ? (
        <View style={d.gap}>
          <Text style={[d.meta, { color: theme.textHeading }]}>{t("teamDesk.takedown.link.label")}</Text>
          <Text style={[d.body, { color: theme.textBody }]}>{t("teamDesk.takedown.link.hint")}</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t("teamDesk.takedown.link.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("teamDesk.takedown.link.label")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={500}
            style={[d.input, { backgroundColor: theme.page, borderColor: theme.line, color: theme.textHeading }]}
          />
          <ActionButton theme={theme} label={t("teamDesk.takedown.link.go")} disabled={busy || address.trim().length < 3} busy={busy} onPress={() => void run("link", () => api.link(item.id, address.trim()))} />
        </View>
      ) : null}

      {step === null ? (
        <View style={d.row}>
          {actions
            .filter((a) => a !== "link")
            .map((action, index) => (
              <ActionButton key={action} theme={theme} tone={index === 0 && action !== "close" ? "primary" : "quiet"} label={t(`teamDesk.takedown.${action}` as "teamDesk.takedown.takeDown")} disabled={busy} busy={busy && index === 0} onPress={() => start(action)} />
            ))}
        </View>
      ) : (
        <View style={d.gap}>
          {step === "takeDown" ? <Hint theme={theme} tone="danger">{t("teamDesk.takedown.takeDown.confirm")}</Hint> : null}
          <Text style={[d.meta, { color: theme.textHeading }]}>{t(step === "takeDown" ? "teamDesk.takedown.takeDown.note" : "teamDesk.takedown.reason.label")}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={step === "takeDown" ? undefined : t("teamDesk.takedown.reason.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t(step === "takeDown" ? "teamDesk.takedown.takeDown.note" : "teamDesk.takedown.reason.label")}
            multiline
            maxLength={step === "takeDown" ? NOTE_MAX : REASON_MAX}
            style={[d.input, { backgroundColor: theme.page, borderColor: theme.line, color: theme.textHeading, minHeight: 80 }]}
          />
          {stepNeedsReason && reasonShort ? <Hint theme={theme} tone="danger">{t("teamDesk.takedown.reason.short")}</Hint> : null}
          <View style={d.row}>
            <ActionButton theme={theme} tone="quiet" label={t("teamDesk.cancel")} onPress={() => setStep(null)} />
            <ActionButton theme={theme} label={step === "takeDown" ? t("teamDesk.takedown.takeDown.go") : t("teamDesk.takedown.reason.send")} disabled={busy || (stepNeedsReason && reasonProblem(text) !== null)} busy={busy} onPress={send} />
          </View>
        </View>
      )}
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}
