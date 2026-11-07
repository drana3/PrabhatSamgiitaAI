import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"

import { Note } from "./ui"

/**
 * The two small panels that open under an item (a chord chart, a video): "what is wrong?" with a reason to pick,
 * and "delete this?" with the plain consequence. Both are answered inside the item, like the comments' own, so no
 * system dialog is needed and the words are the same on the web preview. The caller says what happens on Send.
 */
export function ReportPanel({
  t,
  title,
  reasons,
  sendLabel,
  sendingLabel,
  cancelLabel,
  onSend,
  onCancel,
}: {
  t: SpTheme
  title: string
  reasons: { id: string; label: string }[]
  sendLabel: string
  sendingLabel: string
  cancelLabel: string
  /** resolves to a sentence to show when it failed, or null when it worked */
  onSend: (reason: string) => Promise<string | null>
  onCancel: () => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const send = async () => {
    if (!reason || busy) return
    setBusy(true)
    setProblem(null)
    const failed = await onSend(reason)
    setBusy(false)
    if (failed) setProblem(failed)
  }
  return (
    <View style={styles.panel} accessibilityRole="radiogroup">
      <Text style={[styles.title, { color: t.ink900 }]}>{title}</Text>
      {reasons.map((r) => (
        <SpPress key={r.id} onPress={() => setReason(r.id)} accessibilityRole="radio" accessibilityLabel={r.label} accessibilityState={{ selected: reason === r.id }} pressedScale={0.99} style={styles.radioRow}>
          <View style={[styles.radio, { borderColor: t.ink900 }]}>{reason === r.id ? <View style={[styles.radioDot, { backgroundColor: t.ink900 }]} /> : null}</View>
          <Text style={[styles.radioLabel, { color: t.ink900 }]}>{r.label}</Text>
        </SpPress>
      ))}
      <View style={styles.actions}>
        <Button t={t} label={busy ? sendingLabel : sendLabel} onPress={() => void send()} disabled={!reason || busy} busy={busy} />
        <Button t={t} variant="quiet" label={cancelLabel} onPress={onCancel} />
      </View>
      {problem ? <Note t={t} tone="danger">{problem}</Note> : null}
    </View>
  )
}

export function DeletePanel({
  t,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  t: SpTheme
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  /** resolves to a sentence to show when it failed, or null when it worked */
  onConfirm: () => Promise<string | null>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    const failed = await onConfirm()
    setBusy(false)
    if (failed) setProblem(failed)
  }
  return (
    <View style={styles.panel}>
      <Text style={[styles.title, { color: t.ink900 }]}>{title}</Text>
      <Note t={t} tone="body">{body}</Note>
      <View style={styles.actions}>
        <Button t={t} tone="danger" label={confirmLabel} onPress={() => void confirm()} disabled={busy} busy={busy} />
        <Button t={t} variant="quiet" label={cancelLabel} onPress={onCancel} />
      </View>
      {problem ? <Note t={t} tone="danger">{problem}</Note> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { paddingTop: 12, gap: 4 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12 },
})
