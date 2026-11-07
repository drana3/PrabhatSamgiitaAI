import { useEffect } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { DanceChoices, RequiredMark } from "@/components/kirtan/add/KindFields"
import { ChordsPrompt } from "@/components/recording-extras/ChordsPrompt"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindHasDance, kindHasLanguage, kindRequiresLanguage } from "@/lib/kirtan/kind"
import { languageLabel } from "@/lib/kirtan/languages"
import { isRetryable, queueProgress, type QueueItem, type QueueSummary } from "@/lib/kirtan/queue"
import type { DanceId, RecordingKind } from "@/lib/kirtan/types"
import type { MissingField } from "@/lib/kirtan/uploadForm"
import type { RemoteBrief } from "@/lib/kirtan/remote"
import { uploadErrorText } from "@/lib/kirtan/rules"

/**
 * The upload queue of the add form: a progress bar, one row per file (its own title, its state, a remove button) and
 * the end-of-run summary. A row that sounds like a library recording carries its own question, so it never blocks
 * the others. Everything here is shown from `lib/kirtan/queue` data; it holds no state of its own.
 */

const RemoveGlyph = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  </Svg>
)

/** `3.4 MB`, `820 KB`; nothing when the size is not known. */
export function sizeLabel(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The bar: scales from the left with a spring that starts from where it is on screen. Transform only. */
export function QueueBar({ theme, items }: { theme: SongsTheme; items: readonly QueueItem[] }) {
  const reduce = useReducedMotion()
  const share = queueProgress(items)
  const scale = useSharedValue(share)
  useEffect(() => {
    scale.value = reduce ? share : withSpring(share, amSpring.default)
  }, [share, reduce, scale])
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, scale.value) }] }))
  return (
    <View style={[styles.bar, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <Animated.View style={[styles.barFill, { backgroundColor: amColors.orange700 }, fill]} />
    </View>
  )
}

/** What a row is sent with and what it still lacks (lib/kirtan/queue.ts effectiveFields and rowMissing). */
export type RowKindFields = { kind: RecordingKind; language?: string | null; languageOther?: string | null; dance?: DanceId | null; missing: MissingField[]; tried: boolean }

/** "For every file": one language or dance for all rows at once, and how many rows still lack one. */
export function ApplyToAllCard({ theme, kind, missing, tried, locked, onLanguage, onDance }: { theme: SongsTheme; kind: RecordingKind; missing: { language: number; dance: number; rows: number }; tried: boolean; locked: boolean; onLanguage: () => void; onDance: (dance: DanceId) => void }) {
  const t = useT()
  const warn = tried ? theme.dangerText : theme.textBody
  return (
    <View style={[styles.apply, { backgroundColor: theme.inner, borderColor: theme.line }]}>
      <Text style={[styles.askTitle, { color: theme.textHeading }]}>{t("rec.q.applyTitle")}</Text>
      {kindHasLanguage(kind) ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("rec.q.applyLanguage")} accessibilityState={{ disabled: locked }} onPress={() => !locked && onLanguage()} pressedScale={0.97} style={[styles.small, { backgroundColor: theme.peach }]}>
          <Text style={[styles.smallText, { color: theme.accent }]}>{t("rec.q.applyLanguage")}</Text>
        </KPress>
      ) : null}
      {kindHasDance(kind) ? (
        <View style={styles.applyDance}>
          <Text style={[styles.detail, { color: theme.textBody }]}>{t("rec.q.applyDance")}</Text>
          <DanceChoices theme={theme} value={null} onChange={onDance} disabled={locked} />
        </View>
      ) : null}
      {missing.language > 0 ? (
        <Text style={[styles.detail, { color: warn }]} accessibilityLiveRegion="polite">
          {t("rec.q.needLanguage", { count: missing.language })}
        </Text>
      ) : null}
      {missing.dance > 0 ? (
        <Text style={[styles.detail, { color: warn }]} accessibilityLiveRegion="polite">
          {t("rec.q.needDance", { count: missing.dance })}
        </Text>
      ) : null}
    </View>
  )
}

/** The language and dance of one row: what it will be sent with, a way to change it, and what is still missing. */
function RowKindLine({ theme, item, fields, onLanguage, onDance }: { theme: SongsTheme; item: QueueItem; fields: RowKindFields; onLanguage: (id: string) => void; onDance: (id: string, dance: DanceId) => void }) {
  const t = useT()
  const lacksLanguage = fields.missing.includes("language") || fields.missing.includes("languageName")
  const lacksDance = fields.missing.includes("dance")
  const label = fields.language ? languageLabel(fields.language, fields.languageOther ?? undefined) : ""
  return (
    <View style={styles.kindLine}>
      {kindHasLanguage(fields.kind) ? (
        <View style={styles.kindRow}>
          <Text style={[styles.kindRowLabel, { color: theme.textBody }]}>{t("rec.q.rowLanguage")}</Text>
          <RequiredMark theme={theme} required={kindRequiresLanguage(fields.kind)} invalid={lacksLanguage && fields.tried} />
          <KPress
            accessibilityRole="button"
            accessibilityLabel={t("rec.q.fieldsFor", { title: item.title || item.fileName })}
            onPress={() => onLanguage(item.id)}
            pressedScale={0.96}
            style={[styles.small, { backgroundColor: lacksLanguage ? theme.card : theme.peach, borderWidth: lacksLanguage ? 1.5 : 0, borderColor: lacksLanguage && fields.tried ? amColors.danger : theme.line }]}
          >
            <Text style={[styles.smallText, { color: theme.accent }]} numberOfLines={1}>
              {label || t("rec.q.rowEdit")}
            </Text>
          </KPress>
        </View>
      ) : null}
      {kindHasDance(fields.kind) ? (
        <View style={styles.kindRow}>
          <Text style={[styles.kindRowLabel, { color: theme.textBody }]}>{t("rec.q.rowDance")}</Text>
          <RequiredMark theme={theme} required invalid={lacksDance && fields.tried} />
          <DanceChoices theme={theme} value={fields.dance ?? null} onChange={(dance) => onDance(item.id, dance)} invalid={lacksDance && fields.tried} />
        </View>
      ) : null}
      {fields.missing.map((field) => (
        <Text key={field} style={[styles.detail, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
          {t(`rec.q.missing.${field}`)}
        </Text>
      ))}
    </View>
  )
}

export function QueueRow({
  theme,
  item,
  position,
  kindFields,
  onRowLanguage,
  onRowDance,
  onTitle,
  onRemove,
  onRetry,
  onHear,
  onSimilarYes,
  onSimilarNo,
  onPlaySimilar,
  titleInvalid,
}: {
  theme: SongsTheme
  item: QueueItem
  /** `3` of N, for the spoken label */
  position: number
  /** the type's language and dance for this row; left out where the type has neither */
  kindFields?: RowKindFields
  onRowLanguage?: (id: string) => void
  onRowDance?: (id: string, dance: DanceId) => void
  onTitle: (id: string, title: string) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onHear: (item: QueueItem) => void
  onSimilarYes: (id: string) => void
  onSimilarNo: (id: string) => void
  onPlaySimilar: (brief: RemoteBrief) => void
  titleInvalid?: boolean
}) {
  const t = useT()
  const editable = item.status === "waiting" || item.status === "failed"
  const busy = item.status === "uploading"
  const tone = item.status === "done" ? theme.oliveText : item.status === "failed" || item.status === "limit" ? theme.dangerText : theme.textBody
  const detail =
    item.status === "failed" && item.failure
      ? uploadErrorText(item.failure)
      : item.status === "limit"
        ? t("rec.q.limitRow")
        : item.status === "duplicate"
          ? item.failure?.code === "ownDuplicate"
            ? t("rec.q.ownDuplicate")
            : t("rec.q.duplicate")
          : null
  const meta = [item.fileName, sizeLabel(item.size)].filter(Boolean).join(" · ")
  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: titleInvalid ? amColors.danger : theme.line }]} accessibilityLabel={t("rec.q.rowA11y", { n: position, title: item.title || item.fileName, status: t(`rec.q.status.${item.status}`) })}>
      <View style={styles.top}>
        {editable ? (
          <TextInput
            value={item.title}
            onChangeText={(text) => onTitle(item.id, text)}
            placeholder={t("rec.q.titlePlaceholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("rec.q.titleA11y", { file: item.fileName })}
            maxLength={120}
            editable={item.status === "waiting"}
            style={[styles.titleInput, { color: theme.textHeading, borderBottomColor: titleInvalid ? amColors.danger : theme.line }]}
          />
        ) : (
          <Text style={[styles.titleText, { color: theme.textHeading }]} numberOfLines={2}>
            {item.title || item.fileName}
          </Text>
        )}
        <KPress accessibilityRole="button" accessibilityLabel={t("rec.q.removeA11y", { title: item.title || item.fileName })} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => onRemove(item.id)} pressedScale={0.88} style={[styles.remove, { opacity: busy ? 0.3 : 1 }]}>
          <RemoveGlyph color={theme.textBody} />
        </KPress>
      </View>
      <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
        {meta}
      </Text>
      {kindFields && onRowLanguage && onRowDance && item.status === "waiting" && (kindHasLanguage(kindFields.kind) || kindHasDance(kindFields.kind)) ? <RowKindLine theme={theme} item={item} fields={kindFields} onLanguage={onRowLanguage} onDance={onRowDance} /> : null}
      <ChordsPrompt theme={theme} rowKey={item.id} title={item.title || item.fileName} locked={!editable} />
      <View style={styles.statusLine}>
        <View style={[styles.dot, { backgroundColor: item.status === "uploading" ? amColors.orange700 : tone }]} />
        <Text style={[styles.status, { color: tone }]} accessibilityLiveRegion="polite">
          {t(`rec.q.status.${item.status}`)}
        </Text>
      </View>
      {detail ? <Text style={[styles.detail, { color: item.status === "duplicate" ? theme.textBody : theme.dangerText }]}>{detail}</Text> : null}
      {item.status === "duplicate" && item.original ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("ugc.dup.playA11y", { title: item.original.title })} onPress={() => onHear(item)} pressedScale={0.96} style={[styles.small, { backgroundColor: theme.peach }]}>
          <Text style={[styles.smallText, { color: theme.accent }]} numberOfLines={1}>
            {t("rec.q.hear", { title: item.original.title })}
          </Text>
        </KPress>
      ) : null}
      {item.status === "failed" || item.status === "limit" ? (
        isRetryable(item) ? (
          <KPress accessibilityRole="button" accessibilityLabel={t("rec.q.retryA11y", { title: item.title || item.fileName })} onPress={() => onRetry(item.id)} pressedScale={0.96} style={[styles.small, { backgroundColor: theme.peach }]}>
            <Text style={[styles.smallText, { color: theme.accent }]}>{t("rec.q.retry")}</Text>
          </KPress>
        ) : null
      ) : null}
      {item.status === "similar" && item.similar ? (
        <View style={[styles.ask, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityLiveRegion="polite">
          <Text style={[styles.askTitle, { color: theme.textHeading }]}>{t("ugc.similar.title")}</Text>
          <Text style={[styles.detail, { color: theme.textBody }]}>{t("ugc.similar.body")}</Text>
          {item.similar.briefs.slice(0, 3).map((brief) => (
            <View key={brief.id} style={styles.askRow}>
              <Text style={[styles.askListed, { color: theme.textHeading }]} numberOfLines={2}>
                {t("ugc.similar.listed", { title: brief.title })}
              </Text>
              <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.playA11y", { title: brief.title })} onPress={() => onPlaySimilar(brief)} pressedScale={0.94} style={[styles.small, { backgroundColor: theme.peach }]}>
                <Text style={[styles.smallText, { color: theme.accent }]}>{t("ugc.similar.play")}</Text>
              </KPress>
            </View>
          ))}
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.yes")} onPress={() => onSimilarYes(item.id)} pressedScale={0.98} style={[styles.askButton, { backgroundColor: amColors.orange700 }]}>
            <Text style={styles.askButtonText}>{t("ugc.similar.yes")}</Text>
          </KPress>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.no")} onPress={() => onSimilarNo(item.id)} pressedScale={0.98} style={[styles.askButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
            <Text style={[styles.askButtonText, { color: theme.textHeading }]}>{t("ugc.similar.no")}</Text>
          </KPress>
        </View>
      ) : null}
    </View>
  )
}

/** "12 uploaded, 2 already in the library, 1 needs your decision": the parts that are zero are left out. */
export function QueueSummaryCard({ theme, summary, dailyLimit, onRetryAll, onAddMore, onView, retryable }: { theme: SongsTheme; summary: QueueSummary; dailyLimit: boolean; onRetryAll: () => void; onAddMore: () => void; onView: () => void; retryable: number }) {
  const t = useT()
  const parts: string[] = []
  if (summary.uploaded) parts.push(t("rec.sum.uploaded", { count: summary.uploaded }))
  if (summary.duplicates) parts.push(t("rec.sum.duplicates", { count: summary.duplicates }))
  if (summary.needDecision) parts.push(t("rec.sum.needDecision", { count: summary.needDecision }))
  if (summary.failed) parts.push(t("rec.sum.failed", { count: summary.failed }))
  return (
    <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLiveRegion="polite">
      <Text style={[styles.summaryText, { color: theme.textHeading }]}>{parts.join(", ")}</Text>
      {dailyLimit ? <Text style={[styles.detail, { color: theme.dangerText }]}>{t("rec.q.dailyLimit", { count: summary.left })}</Text> : null}
      {retryable > 0 ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("rec.q.retryAll", { count: retryable })} onPress={onRetryAll} pressedScale={0.98} style={[styles.askButton, { backgroundColor: amColors.orange700 }]}>
          <Text style={styles.askButtonText}>{t("rec.q.retryAll", { count: retryable })}</Text>
        </KPress>
      ) : null}
      {summary.uploaded > 0 ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("ugc.sent.view")} onPress={onView} pressedScale={0.98} style={[styles.askButton, { backgroundColor: amColors.orange700 }]}>
          <Text style={styles.askButtonText}>{t("ugc.sent.view")}</Text>
        </KPress>
      ) : null}
      <KPress accessibilityRole="button" accessibilityLabel={t("rec.q.addMore")} onPress={onAddMore} pressedScale={0.98} style={[styles.askButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <Text style={[styles.askButtonText, { color: theme.textHeading }]}>{t("rec.q.addMore")}</Text>
      </KPress>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { height: 8, borderRadius: 4, borderWidth: 1, overflow: "hidden" },
  barFill: { height: "100%", width: "100%", transformOrigin: "left" } as never,
  row: { borderRadius: 20, borderWidth: 1.5, padding: 14, gap: 6 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titleInput: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22, paddingVertical: 6, borderBottomWidth: 1.5, outlineStyle: "none" as never },
  titleText: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22, paddingVertical: 4 },
  remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: -6, marginRight: -8 },
  meta: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  detail: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  small: { alignSelf: "flex-start", minHeight: 36, paddingHorizontal: 14, borderRadius: 70, alignItems: "center", justifyContent: "center", maxWidth: "100%" },
  smallText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.2 },
  ask: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10, marginTop: 4 },
  askTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  askRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  askListed: { flex: 1, fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  askButton: { height: 48, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  askButtonText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
  apply: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  applyDance: { gap: 8 },
  kindLine: { gap: 8, paddingVertical: 4 },
  kindRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  kindRowLabel: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  summary: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  summaryText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
})
