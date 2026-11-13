import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"

import { MONO } from "@/components/recording-extras/ui"
import { ActionButton, CORNER, Hint } from "@/components/song-chords/parts"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { REASON_MAX, actionsFor, reasonProblem, sheetPreview } from "@/lib/teamReview/rules"
import type { ReviewAction, ReviewItem } from "@/lib/teamReview/types"
import { href } from "@/utils/href"

/**
 * One item on the review desk: where it hangs, who wrote it (the team sees the author of an anonymous item too), the
 * text to judge, then Approve / Remove for an open item or Restore for a removed one. Remove asks for a reason first
 * (required for a chord sheet, whose author reads it). `onAct` does the call and returns a problem sentence or null.
 */
export function ReviewCard({ item, onAct }: { item: ReviewItem; onAct: (item: ReviewItem, action: ReviewAction, reason?: string) => Promise<string | null> }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const [removing, setRemoving] = useState(false)
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
  const where = item.place.kind === "song" ? t("teamReview.where.song", { number: item.place.number }) : t("teamReview.where.recording")
  const open = () => router.push(href(item.place.kind === "song" ? `/song-v2/ps-${item.place.number}` : `/recording/${encodeURIComponent(item.place.id)}`))
  const text = item.source === "recordingSheet" ? sheetPreview(item.text) : item.text
  const short = reasonProblem(item, reason) !== null
  const sheet = item.source === "recordingSheet"

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="review-item">
      <View style={s.head}>
        <Text style={[s.where, { color: theme.textHeading }]} numberOfLines={1}>
          {item.heading && sheet ? `${where} · ${t(`teamReview.instrument.${item.heading}` as "teamReview.instrument.guitar")}` : where}
          {item.isReply ? `  ·  ${t("teamReview.reply")}` : ""}
        </Text>
        <Text style={[s.date, { color: theme.textBody }]}>{formatDate(item.createdAt, "medium")}</Text>
      </View>
      <Text style={[s.meta, { color: theme.textBody }]}>{item.isAnonymous ? t("teamReview.author.anonymous", { name: item.authorName }) : t("teamReview.author", { name: item.authorName })}</Text>
      {item.reportsCount > 0 ? <Text style={[s.meta, { color: theme.dangerText }]}>{t("teamReview.reports", { count: item.reportsCount })}</Text> : null}
      {item.heading && !sheet ? <Text style={[s.heading, { color: theme.textHeading }]}>{item.heading}</Text> : null}
      <Text selectable style={[sheet ? s.mono : s.body, { color: theme.textHeading }]}>
        {text}
      </Text>
      {item.list === "removed" && item.reason ? <Text style={[s.meta, { color: theme.textBody }]}>{t("teamReview.reason", { reason: item.reason })}</Text> : null}

      {removing ? (
        <View style={s.panel}>
          <Text style={[s.heading, { color: theme.textHeading }]}>{t("teamReview.remove.title")}</Text>
          <Text style={[s.meta, { color: theme.textBody }]}>{t(sheet ? "teamReview.remove.sheet" : "teamReview.remove.other")}</Text>
          <View style={[s.input, { backgroundColor: theme.page, borderColor: theme.line }]}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t(sheet ? "teamReview.reason.label" : "teamReview.reason.optional")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t(sheet ? "teamReview.reason.label" : "teamReview.reason.optional")}
              multiline
              maxLength={REASON_MAX}
              style={[s.inputText, { color: theme.textHeading }]}
            />
          </View>
          {sheet && reason.length > 0 && short ? <Hint theme={theme} tone="danger">{t("teamReview.reason.short")}</Hint> : null}
          <View style={s.row}>
            <ActionButton theme={theme} tone="quiet" label={t("teamReview.remove.cancel")} onPress={() => setRemoving(false)} style={s.half} />
            <ActionButton theme={theme} label={t("teamReview.remove.confirm")} disabled={busy !== null || short} busy={busy === "remove"} onPress={() => void run("remove", reason)} style={s.half} />
          </View>
        </View>
      ) : (
        <View style={s.row}>
          {actionsFor(item).map((action) =>
            action === "remove" ? (
              <ActionButton key={action} theme={theme} tone="quiet" label={t("teamReview.remove")} disabled={busy !== null} onPress={() => setRemoving(true)} style={s.half} />
            ) : (
              <ActionButton key={action} theme={theme} label={t(action === "approve" ? "teamReview.approve" : "teamReview.restore")} disabled={busy !== null} busy={busy === action} onPress={() => void run(action)} style={s.half} />
            ),
          )}
        </View>
      )}
      <ActionButton theme={theme} tone="quiet" label={t("teamReview.open")} onPress={open} />
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  where: { flex: 1, fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  date: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  heading: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  mono: { fontFamily: MONO, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  half: { flex: 1 },
  panel: { gap: 8, marginTop: 4 },
  input: { borderWidth: 1.5, borderRadius: CORNER, paddingHorizontal: 12, minHeight: 72, borderColor: amColors.sand400 },
  inputText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, minHeight: 72, textAlignVertical: "top", outlineStyle: "none" as never },
})
