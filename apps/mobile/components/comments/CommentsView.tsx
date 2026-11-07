import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import Svg, { Circle, Path } from "react-native-svg"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatDate, useT } from "@/lib/i18n"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { PREVIEW_NAME } from "@/lib/songComments/mock"
import {
  COMMENT_MAX_LENGTH,
  COMMENT_REPORT_REASONS,
  charactersLeft,
  draftProblem,
  elapsed,
  initialOf,
  liveNotice,
  postingAccess,
  showCounter,
} from "@/lib/songComments/rules"
import type { CommentBase, CommentFailure, CommentReportReason } from "@/lib/songComments/types"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

import { SectionTitle } from "@/components/song-page/ui"

import type { CommentsController } from "./useComments"

type Translate = ReturnType<typeof useT>
type PostFn = CommentsController<CommentBase>["post"]

/** Corner radii of the song page: soft cards like the Meaning card (24 and 20), round buttons and avatars like the pills (9999). */
const R_CARD = 24
const R_FIELD = 20
const R_BOX = 8
const R_ROUND = 9999

/** Whose words the title, the invitation, the "no comments yet" line and the preview note come from; everything else (failures, menus, report reasons) is the shared `songComments.*` set. */
export type CommentsWords = "songComments" | "recordingComments"

/**
 * The comments block: an invitation to share a story, an inspiration or a realization, a text field with a clear
 * "Share anonymously" checkbox (off by default), and the members' comments, newest first. Used under a Prabhat
 * Samgiita song and under a recording. Guests read the comments and are asked to sign in instead of seeing the
 * field. Every state is said honestly: loading, no comments yet, no connection, a server error. Rules and wording:
 * lib/songComments, locales/songComments.ts (and locales/recordingExtras.ts for the few words of a recording).
 */
export function CommentsView<T extends CommentBase>({ t, comments, words, testID }: { t: SpTheme; comments: CommentsController<T>; words: CommentsWords; testID: string }) {
  const tr = useT()
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const myName = useAuthStore((s) => s.displayName)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })
  const { state } = comments
  return (
    <View testID={testID}>
      <SectionTitle t={t}>{tr(`${words}.title`)}</SectionTitle>
      <Text style={[styles.invite, { color: t.ink800 }]}>{tr(`${words}.invite`)}</Text>
      {MOCKUP_DATA ? <Text style={[styles.note, { color: t.ink500 }]}>{tr(`${words}.preview`)}</Text> : null}

      {access === "ok" ? (
        <Composer t={t} name={mode === "signed_in" ? myName : MOCKUP_DATA ? PREVIEW_NAME : ""} post={comments.post} />
      ) : (
        <View style={[styles.gate, { borderColor: t.sand400, backgroundColor: t.white }]}>
          <Text style={[styles.gateText, { color: t.ink800 }]}>{tr(access === "signin" ? "songComments.signin.text" : "songComments.unavailable")}</Text>
          {access === "signin" ? <Button t={t} label={tr("songComments.signin.button")} onPress={() => router.push(href("/signin"))} /> : null}
        </View>
      )}

      <View style={styles.list}>
        {state.status === "ready" && state.total > 0 ? (
          <Text accessibilityRole="header" style={[styles.count, { color: t.ink500 }]}>
            {tr("songComments.count", { count: Math.max(0, state.total - state.items.filter((c) => c.deleted).length) })}
          </Text>
        ) : null}
        {state.status === "loading" ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={t.ink500} />
            <Text style={[styles.statusText, { color: t.ink500 }]}>{tr("songComments.loading")}</Text>
          </View>
        ) : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <Text style={[styles.statusText, { color: t.ink800 }]}>{tr(state.status === "offline" ? "songComments.offline" : "songComments.error")}</Text>
            <Button t={t} variant="quiet" label={tr("songComments.retry")} onPress={() => void comments.reload()} />
          </View>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr(`${words}.empty`)}</Text> : null}
        {state.items.map((comment, index) => (
          <CommentRow key={comment.id} t={t} comment={comment} first={index === 0} comments={comments as CommentsController<CommentBase>} words={words} />
        ))}
        {state.status === "ready" && state.hasMore ? (
          <Button
            t={t}
            variant="quiet"
            label={state.more === "loading" ? tr("songComments.more.loading") : state.more === "error" ? tr("songComments.more.error") : tr("songComments.more")}
            onPress={() => void comments.loadMore()}
            disabled={state.more === "loading"}
          />
        ) : null}
      </View>
    </View>
  )
}

/** The field, the anonymous checkbox, the line that says who the comment will be posted as, and Post. */
function Composer({ t, name, post }: { t: SpTheme; name: string; post: PostFn }) {
  const tr = useT()
  const [text, setText] = useState("")
  const [anonymous, setAnonymous] = useState(false) // always starts off: a name is never hidden or shown by surprise
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" } | { kind: "failure"; failure: CommentFailure } | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const notice = liveNotice(text)
  const ready = !draftProblem(text) && !busy
  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setMessage(null)
    const outcome = await post(text, anonymous)
    if (!alive.current) return
    setBusy(false)
    if (outcome.ok) {
      setText("")
      setMessage({ kind: "ok" })
    } else {
      // the text stays: nothing the person wrote is thrown away by a failure
      setMessage({ kind: "failure", failure: outcome.failure })
    }
  }
  const webField = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null
  return (
    <View style={styles.composer}>
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value)
          if (message) setMessage(null)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
        maxLength={COMMENT_MAX_LENGTH}
        placeholder={tr("songComments.field.placeholder")}
        placeholderTextColor={t.ink500}
        accessibilityLabel={tr("songComments.field.a11y")}
        editable={!busy}
        style={[styles.field, webField, { color: t.ink900, backgroundColor: t.white, borderColor: focused ? t.action : t.sand400, borderWidth: focused ? 2 : 1 }]}
      />
      {showCounter(text) ? (
        <Text style={[styles.counter, { color: charactersLeft(text) <= 20 ? t.dangerText : t.ink500 }]} accessibilityLiveRegion="polite">
          {tr("songComments.counter", { count: Math.max(0, charactersLeft(text)) })}
        </Text>
      ) : null}

      {/* Said while the person types, not only after a failed send: the Post button is shut for this reason and must not be a mystery. */}
      {notice === "links" ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.message, { color: t.dangerText }]}>
          {tr("songComments.failure.links")}
        </Text>
      ) : null}

      <SpPress
        onPress={() => setAnonymous((on) => !on)}
        accessibilityRole="checkbox"
        accessibilityLabel={tr("songComments.anonymous.a11y")}
        accessibilityState={{ checked: anonymous }}
        pressedScale={0.99}
        style={styles.checkRow}
      >
        <View style={[styles.box, { borderColor: t.ink900, backgroundColor: anonymous ? t.ink900 : t.white }]}>
          {anonymous ? <SpIcon name="check" size={18} color={t.onInk} strokeWidth={2.5} /> : null}
        </View>
        <Text style={[styles.checkLabel, { color: t.ink900 }]}>{tr("songComments.anonymous.label")}</Text>
      </SpPress>
      <Text style={[styles.as, { color: t.ink800 }]}>
        {anonymous ? tr("songComments.as.anonymous") : name ? tr("songComments.as.named", { name }) : tr("songComments.as.namedNoName")}
      </Text>
      {anonymous ? <Text style={[styles.as, styles.team, { color: t.ink500 }]}>{tr("songComments.as.team")}</Text> : null}

      <View style={styles.postRow}>
        <Button t={t} label={busy ? tr("songComments.posting") : tr("songComments.post")} onPress={() => void submit()} disabled={!ready} busy={busy} />
      </View>
      {message ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.message, { color: message.kind === "ok" ? t.ink800 : t.dangerText }]}>
          {message.kind === "ok" ? tr("songComments.posted") : tr(`songComments.failure.${message.failure}`)}
        </Text>
      ) : null}
    </View>
  )
}

type Panel = null | "menu" | "report" | "delete"

function CommentRow({ t, comment, first, comments, words }: { t: SpTheme; comment: CommentBase; first: boolean; comments: CommentsController<CommentBase>; words: CommentsWords }) {
  const tr = useT()
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<CommentReportReason | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [problem, setProblem] = useState<CommentFailure | null>(null)
  const name = comment.author?.name ?? tr("songComments.anonymous")
  const mineOrTeam = comment.mine || comment.canRemove

  // What an author's own delete leaves under a recording: one quiet line, no name, no text, nothing to press.
  if (comment.deleted) {
    return (
      <View style={[styles.item, { borderTopColor: t.sand400, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]} testID="comment-deleted">
        <Avatar t={t} comment={comment} label={tr("songComments.anonymous.avatar")} />
        <View style={styles.itemMain}>
          <Text style={[styles.body, { color: t.ink500, fontFamily: amFonts.medium }]}>{words === "recordingComments" ? tr("recordingComments.deleted") : null}</Text>
          <Text style={[styles.time, { color: t.ink500 }]}>{timeLabel(tr, comment.createdAt)}</Text>
        </View>
      </View>
    )
  }

  const open = (next: Panel) => {
    setPanel(next)
    setProblem(null)
  }
  const sendReport = async () => {
    if (!reason || busy) return
    setBusy(true)
    const result = await comments.report(comment.id, reason)
    setBusy(false)
    if (!result.ok) return setProblem(result.failure)
    setNote(tr(MOCKUP_DATA ? "songComments.report.demo" : result.status === "already_reported" ? "songComments.report.already" : "songComments.report.sent"))
    setPanel(null)
  }
  const confirmDelete = async () => {
    if (busy) return
    setBusy(true)
    const failure = await comments.remove(comment.id)
    setBusy(false)
    if (failure && failure !== "gone") setProblem(failure)
  }

  return (
    <View style={[styles.item, { borderTopColor: t.sand400, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <Avatar t={t} comment={comment} label={comment.author ? name : tr("songComments.anonymous.avatar")} />
      <View style={styles.itemMain}>
        <View style={styles.itemHead}>
          <View style={styles.itemWho}>
            <Text style={[styles.name, { color: t.ink900 }]} numberOfLines={1}>
              {name}
              {comment.mine ? <Text style={{ color: t.ink500, fontFamily: amFonts.medium }}>{`  ·  ${tr("songComments.you")}`}</Text> : null}
            </Text>
            <Text style={[styles.time, { color: t.ink500 }]}>{timeLabel(tr, comment.createdAt)}</Text>
          </View>
          <SpPress onPress={() => open(panel ? null : "menu")} accessibilityLabel={panel ? tr("songComments.menu.close") : tr("songComments.menu.a11y")} accessibilityState={{ selected: panel !== null }} pressedScale={0.92} style={styles.more}>
            {panel ? <SpIcon name="close" size={20} color={t.ink800} strokeWidth={2} /> : <PlayerIcon name="more" size={22} color={t.ink800} />}
          </SpPress>
        </View>
        <Text selectable style={[styles.body, { color: t.ink900 }]}>
          {comment.body}
        </Text>

        {panel === "menu" ? (
          <View style={styles.actions}>
            {!comment.mine ? <Button t={t} variant="quiet" label={tr("songComments.menu.report")} onPress={() => open("report")} /> : null}
            {mineOrTeam ? <Button t={t} variant="quiet" tone="danger" label={tr(comment.mine ? "songComments.menu.delete" : "songComments.menu.remove")} onPress={() => open("delete")} /> : null}
          </View>
        ) : null}

        {panel === "report" ? (
          <View style={styles.panel} accessibilityRole="radiogroup">
            <Text style={[styles.panelTitle, { color: t.ink900 }]}>{tr("songComments.report.title")}</Text>
            {COMMENT_REPORT_REASONS.map((r) => (
              <SpPress key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityLabel={tr(`songComments.report.${r}`)} accessibilityState={{ selected: reason === r }} pressedScale={0.99} style={styles.radioRow}>
                <View style={[styles.radio, { borderColor: t.ink900 }]}>{reason === r ? <View style={[styles.radioDot, { backgroundColor: t.ink900 }]} /> : null}</View>
                <Text style={[styles.radioLabel, { color: t.ink900 }]}>{tr(`songComments.report.${r}`)}</Text>
              </SpPress>
            ))}
            <View style={styles.actions}>
              <Button t={t} label={busy ? tr("songComments.report.sending") : tr("songComments.report.send")} onPress={() => void sendReport()} disabled={!reason || busy} busy={busy} />
              <Button t={t} variant="quiet" label={tr("songComments.delete.cancel")} onPress={() => open(null)} />
            </View>
          </View>
        ) : null}

        {panel === "delete" ? (
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, { color: t.ink900 }]}>{tr("songComments.delete.title")}</Text>
            <Text style={[styles.as, { color: t.ink800 }]}>{tr(comment.mine ? "songComments.delete.body" : "songComments.remove.body")}</Text>
            <View style={styles.actions}>
              <Button t={t} tone="danger" label={tr("songComments.delete.confirm")} onPress={() => void confirmDelete()} disabled={busy} busy={busy} />
              <Button t={t} variant="quiet" label={tr("songComments.delete.cancel")} onPress={() => open(null)} />
            </View>
          </View>
        ) : null}

        {note ? (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: t.ink800 }]}>
            {note}
          </Text>
        ) : null}
        {problem ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.message, { color: t.dangerText }]}>
            {tr(`songComments.failure.${problem}`)}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function timeLabel(tr: Translate, createdAt: string): string {
  const e = elapsed(createdAt)
  switch (e.kind) {
    case "now":
      return tr("songComments.time.now")
    case "minutes":
      return tr("songComments.time.minutes", { count: e.count })
    case "hours":
      return tr("songComments.time.hours", { count: e.count })
    case "days":
      return tr("songComments.time.days", { count: e.count })
    default:
      return formatDate(createdAt, "medium")
  }
}

/** A square: the photo of a named member, their initial when there is no photo, a plain silhouette for "Anonymous". */
function Avatar({ t, comment, label }: { t: SpTheme; comment: CommentBase; label: string }) {
  const [broken, setBroken] = useState(false)
  const photo = comment.author?.avatarUrl && !broken ? comment.author.avatarUrl : null
  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={[styles.avatar, { backgroundColor: t.sand300 }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatarImage} onError={() => setBroken(true)} accessibilityIgnoresInvertColors />
      ) : comment.author ? (
        <Text style={[styles.initial, { color: t.ink800 }]}>{initialOf(comment.author.name)}</Text>
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8.5} r={3.5} stroke={t.ink500} strokeWidth={1.75} />
          <Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke={t.ink500} strokeWidth={1.75} strokeLinecap="round" />
        </Svg>
      )}
    </View>
  )
}

/** A 48-high square-cornered button: filled (the main action), or quiet (outlined). */
export function Button({
  t,
  label,
  onPress,
  variant = "solid",
  tone = "normal",
  disabled,
  busy,
}: {
  t: SpTheme
  label: string
  onPress: () => void
  variant?: "solid" | "quiet"
  tone?: "normal" | "danger"
  disabled?: boolean
  busy?: boolean
}) {
  const solid = variant === "solid"
  const danger = tone === "danger"
  const bg = !solid ? "transparent" : disabled && !busy ? t.sand300 : danger ? t.danger : t.action
  const fg = !solid ? (danger ? t.dangerText : t.ink900) : disabled && !busy ? t.ink500 : "#FFFFFF"
  return (
    <SpPress
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.button, { backgroundColor: bg, borderColor: solid ? "transparent" : danger ? t.dangerText : t.ink800, borderWidth: solid ? 0 : 1 }]}
    >
      <Text style={[styles.buttonLabel, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </SpPress>
  )
}

const styles = StyleSheet.create({
  invite: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 26, paddingHorizontal: 20, paddingBottom: 8 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8 },
  composer: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  field: { minHeight: 112, paddingHorizontal: 14, paddingVertical: 14, borderRadius: R_FIELD, fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24, textAlignVertical: "top" },
  counter: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, textAlign: "right" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingTop: 4 },
  box: { width: 24, height: 24, borderWidth: 2, borderRadius: R_BOX, alignItems: "center", justifyContent: "center" },
  checkLabel: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, flexShrink: 1 },
  as: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  team: { fontSize: 13, lineHeight: 18 },
  postRow: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 12 },
  message: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20, paddingTop: 8 },
  gate: { marginHorizontal: 20, marginTop: 8, padding: 20, borderWidth: 1, borderRadius: R_CARD, gap: 12, alignItems: "flex-start" },
  gateText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  list: { paddingHorizontal: 20, paddingTop: 28 },
  count: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", paddingBottom: 8 },
  status: { alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  statusText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, paddingVertical: 8 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 16 },
  itemMain: { flex: 1, minWidth: 0 },
  itemHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  itemWho: { flex: 1, minWidth: 0 },
  name: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 22 },
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  more: { width: 44, height: 44, marginTop: -8, marginRight: -10, alignItems: "center", justifyContent: "center" },
  body: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 25, paddingTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12 },
  panel: { paddingTop: 12, gap: 4 },
  panelTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  avatar: { width: 40, height: 40, borderRadius: R_ROUND, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 40, height: 40 },
  initial: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 24 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 24, borderRadius: R_ROUND, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  buttonLabel: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
