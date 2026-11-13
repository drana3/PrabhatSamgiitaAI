import { useEffect, useRef, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import { SheetPill } from "@/components/player-v2/Rows"
import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import { REPORT_COMMENT_MAX, REPORT_REASONS, reportReasonHint, reportReasonLabel, type ReportReason } from "@/lib/kirtan/rules"
import { blockAuthorOf, canBlockAuthor, reportRecording, type ReportResult } from "@/lib/kirtan/safety"
import type { Kirtan } from "@/lib/kirtan/types"
import { useSaveSheetStore } from "@/stores/saveSheetStore"
import { useSafetySheetStore } from "@/stores/safetySheetStore"
import { href } from "@/utils/href"

/**
 * The Report sheet and the "Block this author" confirmation of a Kiirtan or a Bhajan (App Store 1.2, Play UGC).
 * One of each for the app; the save host mounts this, so the sheets also rise over the full player.
 * A report really goes to the server (lib/kirtan/safety.ts) and the sheet shows what the server answered.
 */
export function KirtanSafetyHost() {
  const report = useSafetySheetStore((s) => s.report)
  const block = useSafetySheetStore((s) => s.block)
  const closeReport = useSafetySheetStore((s) => s.closeReport)
  const closeBlock = useSafetySheetStore((s) => s.closeBlock)
  return (
    <>
      <ReportSheet kirtan={report} onClose={closeReport} />
      <BlockSheet kirtan={block} onClose={closeBlock} />
    </>
  )
}

type Phase = "form" | "sending" | "sent" | "error"

function ReportSheet({ kirtan, onClose }: { kirtan: Kirtan | null; onClose: () => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current

  const [reason, setReason] = useState<ReportReason | null>(null)
  const [comment, setComment] = useState("")
  const [phase, setPhase] = useState<Phase>("form")
  const [result, setResult] = useState<ReportResult | null>(null)
  const id = kirtan?.id ?? null

  // a fresh form every time the sheet opens
  useEffect(() => {
    if (!id) return
    setReason(null)
    setComment("")
    setPhase("form")
    setResult(null)
  }, [id])

  const send = async () => {
    if (!shown || !reason || phase === "sending") return
    setPhase("sending")
    try {
      setResult(await reportRecording(shown, { reason, comment }))
      setPhase("sent")
    } catch {
      setPhase("error")
    }
  }

  const openRules = () => {
    onClose()
    router.push(href("/content-rules"))
  }

  const sent = phase === "sent"
  return (
    <BottomSheet
      open={Boolean(kirtan)}
      onClose={onClose}
      theme={theme}
      eyebrow={t("ugc.report.eyebrow")}
      accessibilityLabel={t("ugc.report.a11y")}
      doneLabel={sent ? t("ugc.report.done") : undefined}
    >
      {shown ? (
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={3}>
          {shown.title}
        </Text>
      ) : null}

      {sent && result ? (
        <View style={styles.stack} accessibilityLiveRegion="polite">
          <Text style={[styles.sentTitle, { color: theme.textHeading }]}>{t("ugc.report.sentTitle")}</Text>
          <Text style={[styles.note, { color: theme.textBody }]}>
            {result.demo ? t("ugc.report.demo") : result.status === "already_reported" ? t("ugc.report.already") : t("ugc.report.sentBody")}
          </Text>
          {shown && canBlockAuthor(shown) ? (
            <SheetPill
              theme={theme}
              tone="sand"
              label={t("ugc.block.row")}
              onPress={() => {
                onClose()
                useSafetySheetStore.getState().openBlock(shown)
              }}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={[styles.note, { color: theme.textBody }]}>{t("ugc.report.intro")}</Text>
          <View accessibilityRole="radiogroup" style={styles.stack}>
            {REPORT_REASONS.map((r) => (
              <ReasonRow key={r} theme={theme} reason={r} on={reason === r} onPick={() => setReason(r)} />
            ))}
          </View>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.report.comment")}</Text>
          <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t("ugc.report.commentPlaceholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("ugc.report.comment")}
              maxLength={REPORT_COMMENT_MAX}
              multiline
              style={[styles.input, { color: theme.textHeading }]}
            />
          </View>
          {phase === "error" ? (
            <Text style={[styles.note, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
              {t("ugc.report.error")}
            </Text>
          ) : null}
          <SheetPill
            theme={theme}
            label={phase === "sending" ? t("ugc.report.sending") : t("ugc.report.send")}
            onPress={() => void send()}
            disabled={!reason || phase === "sending"}
          />
          <KPress accessibilityRole="link" accessibilityLabel={t("ugc.report.rulesLink")} onPress={openRules} pressedScale={0.98} style={styles.link}>
            <Text style={[styles.linkText, { color: theme.accent }]}>{t("ugc.report.rulesLink")}</Text>
          </KPress>
        </View>
      )}
    </BottomSheet>
  )
}

function ReasonRow({ theme, reason, on, onPick }: { theme: SongsTheme; reason: ReportReason; on: boolean; onPick: () => void }) {
  return (
    <KPress
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${reportReasonLabel(reason)}. ${reportReasonHint(reason)}`}
      onActivate={onPick}
      pressedScale={0.985}
      style={[styles.reason, { borderColor: on ? amColors.orange700 : theme.line, backgroundColor: theme.card }]}
    >
      <View style={[styles.radio, { borderColor: on ? amColors.orange700 : theme.textBody }]}>
        {on ? <View style={[styles.radioDot, { backgroundColor: amColors.orange700 }]} /> : null}
      </View>
      <View style={styles.reasonText}>
        <Text style={[styles.reasonLabel, { color: theme.textHeading }]}>{reportReasonLabel(reason)}</Text>
        <Text style={[styles.reasonHint, { color: theme.textBody }]}>{reportReasonHint(reason)}</Text>
      </View>
    </KPress>
  )
}

function BlockSheet({ kirtan, onClose }: { kirtan: Kirtan | null; onClose: () => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const last = useRef<Kirtan | null>(null)
  if (kirtan) last.current = kirtan
  const shown = kirtan ?? last.current
  const [busy, setBusy] = useState(false)
  const name = shown?.author.trim() || t("ugc.block.thisAuthor")

  const confirm = async () => {
    if (!shown || busy) return
    setBusy(true)
    let synced = true
    try {
      await blockAuthorOf(shown)
    } catch {
      synced = false
    }
    setBusy(false)
    onClose()
    useSaveSheetStore.getState().showToast(synced ? t("ugc.block.done", { author: name }) : t("ugc.block.syncFailed"))
  }

  return (
    <BottomSheet
      open={Boolean(kirtan)}
      onClose={onClose}
      theme={theme}
      eyebrow={kindLabel(shown?.kind)}
      accessibilityLabel={t("ugc.block.row")}
      doneLabel={t("ugc.block.cancel")}
    >
      <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={3}>
        {t("ugc.block.title", { author: name })}
      </Text>
      <Text style={[styles.note, { color: theme.textBody }]}>{t("ugc.block.body")}</Text>
      <SheetPill theme={theme} label={t("ugc.block.confirm")} onPress={() => void confirm()} disabled={busy} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, marginTop: 6 },
  sentTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 24 },
  reason: { minHeight: 60, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  reasonText: { flex: 1, gap: 2 },
  reasonLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  reasonHint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  inputBox: { minHeight: 76, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16 },
  input: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, minHeight: 72, textAlignVertical: "top", outlineStyle: "none" as never },
  link: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  linkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, textDecorationLine: "underline" },
})
