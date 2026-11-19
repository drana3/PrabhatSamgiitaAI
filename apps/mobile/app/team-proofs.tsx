import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AccountField } from "@/components/account/AccountUi"
import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, Chip, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { proofActions, proofOrder, type DeskProof, type ProofAction } from "@/lib/authors/desk"
import { claimsDesk, deskFailure } from "@/lib/authors/deskApi"
import { say } from "@/lib/authors/text"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

type Status = "loading" | "ready" | "error" | "offline" | "denied"

/**
 * The team's desk for proofs of identity (docs/author-profiles.md, "Proof of identity"): one proof per author page.
 * For each waiting proof the team can e-mail the code, accept it (also approving the page's waiting requests), decline
 * it or ask for more. The person is told only after the answer. Team only: the server decides.
 */
export default function TeamProofsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const top = useScreenTop()
  const clear = useScrollBottomInset()
  const [state, setState] = useState<{ status: Status; items: DeskProof[] }>({ status: "loading", items: [] })
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    claimsDesk()
      .proofs()
      .then((page) => {
        if (active) setState({ status: "ready", items: proofOrder(page.items) })
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = deskFailure(error)
        setState({ status: failure === "denied" ? "denied" : failure === "network" ? "offline" : "error", items: [] })
      })
    return () => {
      active = false
    }
  }, [reload])

  const done = useCallback((text: string) => {
    setNotice(text)
    setProblem(null)
    setReload((n) => n + 1)
  }, [])

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/team-claims")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("common.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: clear + 48 }]}>
        <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
          {t("teamProof.title")}
        </Text>
        <Hint theme={theme}>{t("teamProof.lead")}</Hint>
        {state.status === "loading" ? <Hint theme={theme}>{t("teamProof.loading")}</Hint> : null}
        {state.status === "denied" ? <Hint theme={theme} tone="danger">{t("teamProof.denied")}</Hint> : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={s.gap}>
            <Hint theme={theme} tone="danger">{t(state.status === "offline" ? "teamProof.offline" : "teamProof.error")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("claimsDesk.retry")} onPress={() => setReload((n) => n + 1)} />
          </View>
        ) : null}
        {state.status === "ready" && !state.items.length ? <Hint theme={theme}>{t("teamProof.empty")}</Hint> : null}
        {notice ? <Hint theme={theme}>{notice}</Hint> : null}
        {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
        {state.items.map((proof) => (
          <ProofCard key={proof.id} proof={proof} onDone={done} onFail={(failure) => setProblem(t(failure === "network" ? "teamProof.offline" : "teamProof.failed"))} />
        ))}
      </ScrollView>
    </View>
  )
}

function ProofCard({ proof, onDone, onFail }: { proof: DeskProof; onDone: (text: string) => void; onFail: (failure: ReturnType<typeof deskFailure>) => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const [note, setNote] = useState("")
  const [approveWaiting, setApproveWaiting] = useState(true)
  const [busy, setBusy] = useState(false)

  const run = async (action: ProofAction | "code") => {
    if (busy) return
    if (action === "more" && !note.trim()) return
    setBusy(true)
    try {
      if (action === "code") {
        const { sent } = await claimsDesk().sendCode(proof.id)
        onDone(t(sent ? "teamProof.done.code" : "teamProof.done.codeNotSent"))
      } else {
        await claimsDesk().decideProof(proof.id, action, { note, approveWaiting })
        onDone(say(t, `teamProof.done.${action}`))
      }
    } catch (error) {
      onFail(deskFailure(error))
    } finally {
      setBusy(false)
    }
  }
  const actions = proofActions(proof)
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[s.name, { color: theme.textHeading }]}>{t("teamProof.page", { name: proof.profile_name })}</Text>
      <Text style={[s.kind, { color: theme.accent }]}>{say(t, `claimProof.kind.${proof.kind}`)}</Text>
      <Text style={[s.value, { color: theme.textBody }]} selectable>
        {proof.value}
      </Text>
      {proof.note ? <Hint theme={theme}>{proof.note}</Hint> : null}
      {proof.code_confirmed ? <Hint theme={theme}>{t("teamProof.codeConfirmed")}</Hint> : null}
      {proof.overdue ? <Hint theme={theme} tone="danger">{t("teamProof.overdue")}</Hint> : null}
      {actions.length ? (
        <>
          <AccountField theme={theme} label={t("teamProof.note.field")} value={note} onChangeText={setNote} maxLength={1000} multiline />
          {actions.includes("ok") ? (
            <View style={s.chips}>
              <Chip theme={theme} role="button" label={t("teamProof.approveWaiting")} on={approveWaiting} onPress={() => setApproveWaiting((v) => !v)} />
            </View>
          ) : null}
          <View style={s.chips}>
            {actions.map((action, index) => (
              <ActionButton
                key={action}
                theme={theme}
                tone={action === "ok" ? "primary" : "quiet"}
                label={t(`teamProof.action.${action}` as "teamProof.action.ok")}
                disabled={busy || (action === "more" && !note.trim())}
                busy={busy && index === 0}
                onPress={() => void run(action)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingBottom: 6, flexDirection: "row" },
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  content: { paddingHorizontal: 24, gap: 16, paddingTop: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.9, textTransform: "uppercase" },
  gap: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 10 },
  name: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  kind: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  value: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
})
