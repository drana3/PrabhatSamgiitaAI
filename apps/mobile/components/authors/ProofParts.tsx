import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { AccountField, InlineError } from "@/components/account/AccountUi"
import { Chip, PillButton, SectionTitle, SIDE } from "@/components/authors/AuthorsUi"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorsApi } from "@/lib/authors/api"
import {
  CODE_LENGTH,
  canSendProof,
  cleanCode,
  cleanProofValue,
  codeReady,
  daysUntil,
  kindsToOffer,
  needsPerson,
  progress,
  proofErrorKey,
  proofNeedingCode,
  proofProblem,
  stageTone,
  statusTone,
  type StageTone,
} from "@/lib/authors/proofs"
import { say } from "@/lib/authors/text"
import type { ProofKind, ProofOut, RequestState } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { errorKeyOf } from "@/stores/authorStore"

function toneColor(theme: SongsTheme, tone: StageTone): string {
  if (tone === "good") return theme.accentText
  if (tone === "bad") return theme.textMuted
  if (tone === "act") return theme.textHeading
  return theme.textBody
}

/** The short card on the claims screen: where the request stands and a way into the full screen. */
export function RequestCard({ theme, state, onOpen }: { theme: SongsTheme; state: RequestState; onOpen: () => void }) {
  const t = useT()
  const line = needsPerson(state) ? "claimProof.card.act" : state.verified ? "claimProof.card.verified" : state.stage === "with_team" ? "claimProof.card.waiting" : "claimProof.card.none"
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{t("claimProof.card.title")}</Text>
      <Text style={[styles.body, { color: toneColor(theme, stageTone(state.stage)) }]}>{say(t, line)}</Text>
      <PillButton theme={theme} tone={needsPerson(state) || state.stage === "no_proof" ? "brand" : "line"} label={t("claimProof.card.open")} onPress={onOpen} />
    </View>
  )
}

/** Where the request stands: stage, proofs counted, and the 3-day and 14-day dates. */
export function StageBlock({ theme, state }: { theme: SongsTheme; state: RequestState }) {
  const t = useT()
  const p = progress(state)
  const answer = daysUntil(state.answer_by)
  const closes = daysUntil(state.closes_at)
  return (
    <View style={styles.stack}>
      <Text style={[styles.stage, { color: toneColor(theme, stageTone(state.stage)) }]} accessibilityRole="header">
        {say(t, `claimProof.stage.${state.stage}.title`)}
      </Text>
      <Text style={[styles.body, { color: theme.textBody }]}>{say(t, `claimProof.stage.${state.stage}.body`)}</Text>
      <Text style={[styles.note, { color: theme.textMuted }]}>{say(t, "claimProof.progress", { have: p.have, required: p.required })}</Text>
      <Text style={[styles.note, { color: theme.textMuted }]}>{say(t, `claimProof.why.${state.why_required}`)}</Text>
      {state.stage === "with_team" && answer !== null ? <Text style={[styles.note, { color: theme.textMuted }]}>{t("claimProof.answerBy", { days: answer })}</Text> : null}
      {closes !== null && state.stage !== "verified" ? <Text style={[styles.note, { color: theme.textMuted }]}>{t("claimProof.closesIn", { days: closes })}</Text> : null}
      <Text style={[styles.note, { color: theme.textMuted }]}>{t("claimProof.privacy")}</Text>
    </View>
  )
}

/** The proofs sent so far, each with its state and what the team wrote; a live one can be withdrawn. */
export function ProofList({ theme, proofs, onChanged }: { theme: SongsTheme; proofs: ProofOut[]; onChanged: () => void }) {
  const t = useT()
  const api = authorsApi()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const withdraw = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      await api.withdrawProof(id)
      onChanged()
    } catch (failure) {
      setError(proofErrorKey(failure, errorKeyOf))
    } finally {
      setBusy(null)
    }
  }
  const shown = proofs.filter((p) => p.status !== "withdrawn")
  if (!shown.length) return null
  return (
    <View style={styles.stack}>
      {error ? <InlineError theme={theme}>{say(t, error)}</InlineError> : null}
      {shown.map((p) => (
        <View key={p.id} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <View style={styles.flexText}>
            <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{say(t, `claimProof.kind.${p.kind}`)}</Text>
            <Text style={[styles.note, { color: theme.textBody }]} numberOfLines={2}>
              {p.value}
            </Text>
            <Text style={[styles.note, { color: toneColor(theme, statusTone(p.status)) }]}>{say(t, `claimProof.status.${p.status}`)}</Text>
            {p.team_note ? <Text style={[styles.note, { color: theme.textMuted }]}>{t("claimProof.teamNote", { note: p.team_note })}</Text> : null}
          </View>
          {p.status === "waiting" || p.status === "code_sent" ? <PillButton theme={theme} tone="line" busy={busy === p.id} label={t("claimProof.withdraw")} onPress={() => void withdraw(p.id)} /> : null}
        </View>
      ))}
    </View>
  )
}

/** The six-digit code the team e-mailed. */
export function CodeBox({ theme, state, onChanged }: { theme: SongsTheme; state: RequestState; onChanged: () => void }) {
  const t = useT()
  const api = authorsApi()
  const proof = proofNeedingCode(state)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!proof) return null
  const send = async () => {
    if (!codeReady(code) || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.enterProofCode(proof.id, cleanCode(code))
      setCode("")
      onChanged()
    } catch (failure) {
      setError(proofErrorKey(failure, errorKeyOf))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={styles.stack}>
      <AccountField theme={theme} label={t("claimProof.code.field")} value={code} onChangeText={(v) => setCode(cleanCode(v))} keyboardType="number-pad" maxLength={CODE_LENGTH} returnKeyType="done" onSubmitEditing={() => void send()} error={error ? say(t, error) : null} />
      <PillButton theme={theme} busy={busy} disabled={!codeReady(code)} label={t("claimProof.code.send")} onPress={() => void send()} />
    </View>
  )
}

/** Add one proof: pick the kind, write the text, send. A kind that already waits is not offered twice. */
export function ProofForm({ theme, state, onChanged }: { theme: SongsTheme; state: RequestState; onChanged: () => void }) {
  const t = useT()
  const api = authorsApi()
  const kinds = kindsToOffer(state)
  const [picked, setPicked] = useState<ProofKind | null>(null)
  const [value, setValue] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  if (!canSendProof(state) || !kinds.length) return null
  const kind = picked && kinds.includes(picked) ? picked : kinds[0]!
  const problem = value.trim() ? proofProblem(kind, value) : null

  const send = async () => {
    if (busy || proofProblem(kind, value)) return
    setBusy(true)
    setError(null)
    setSent(false)
    try {
      await api.sendProof({ kind, value: cleanProofValue(kind, value), note: note.trim() || undefined })
      setValue("")
      setNote("")
      setSent(true)
      onChanged()
    } catch (failure) {
      setError(proofErrorKey(failure, errorKeyOf))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={styles.stack}>
      <SectionTitle theme={theme}>{t("claimProof.add")}</SectionTitle>
      <View style={styles.chips}>
        {kinds.map((k) => (
          <Chip key={k} theme={theme} label={say(t, `claimProof.kind.${k}`)} active={k === kind} onPress={() => setPicked(k)} />
        ))}
      </View>
      <Text style={[styles.note, { color: theme.textMuted }]}>{say(t, `claimProof.kind.${kind}.hint`)}</Text>
      <AccountField
        theme={theme}
        label={say(t, `claimProof.kind.${kind}.field`)}
        value={value}
        onChangeText={setValue}
        maxLength={500}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={kind === "email" ? "email-address" : kind === "link" ? "url" : "default"}
        error={problem ? say(t, `claimProof.problem.${problem}`) : null}
      />
      <AccountField theme={theme} label={t("claimProof.note.field")} value={note} onChangeText={setNote} maxLength={300} multiline />
      {error ? <InlineError theme={theme}>{say(t, error)}</InlineError> : null}
      {sent ? <Text style={[styles.note, { color: theme.accentText }]}>{t("claimProof.sent")}</Text> : null}
      <PillButton theme={theme} busy={busy} disabled={!value.trim() || Boolean(problem)} label={t("claimProof.send")} onPress={() => void send()} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { marginHorizontal: SIDE, padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  cardTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  stage: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  flexText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
