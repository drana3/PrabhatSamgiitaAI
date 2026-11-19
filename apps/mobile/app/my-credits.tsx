import { useState } from "react"
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { InlineError } from "@/components/account/AccountUi"
import { LoadingRows, PillButton, SectionTitle, SIDE, WEB_THUMB } from "@/components/authors/AuthorsUi"
import { CreditsFrame } from "@/components/credits/CreditsFrame"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { say } from "@/lib/authors/text"
import { creditsApi } from "@/lib/credits/api"
import type { MyCredit } from "@/lib/credits/remote"
import { switchTrackOff } from "@/lib/controlColors"
import { useT } from "@/lib/i18n"
import { CREDIT_ROLES, roleKey } from "@/lib/kirtan/credits"
import { kindLabel, normalizeKind } from "@/lib/kirtan/kind"
import { errorKeyOf } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * "My credits": the recordings where the person said yes (hide one from the page, or take themselves off it), the invitations
 * that wait, and "Who can name me on recordings" (everyone / nobody) with the list of people they blocked.
 */
export default function MyCreditsScreen() {
  const t = useT()
  return <CreditsFrame title={t("credits.mine.bar")} needPage>{() => <Body />}</CreditsFrame>
}

function Body() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const bottom = useScrollBottomInset()
  const api = creditsApi()
  const mine = useAuthorRequest(() => api.mine(), [])
  const invites = useAuthorRequest(() => api.invites(), [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)

  const run = async (id: string, work: () => Promise<void>) => {
    if (busy) return
    setBusy(id)
    setError(null)
    try {
      await work()
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const toggle = (row: MyCredit, shown: boolean) =>
    run(row.credit_id, async () => {
      await authorsApi().setShown(row.recording.id, shown)
      mine.setData((mine.data ?? []).map((r) => (r.credit_id === row.credit_id ? { ...r, shown } : r)))
    })

  const leave = (row: MyCredit) =>
    run(row.credit_id, async () => {
      await api.leave(row.credit_id)
      mine.setData((mine.data ?? []).filter((r) => r.credit_id !== row.credit_id))
      setAsking(null)
    })

  const rows = mine.data ?? []
  const waiting = invites.data?.length ?? 0
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 24, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <Text style={[s.heading, { color: theme.textHeading }]} accessibilityRole="header">
          {t("credits.mine.title")}
        </Text>
        <Text style={[s.body, { color: theme.textBody }]}>{t("credits.mine.lead")}</Text>
      </View>

      {waiting > 0 ? (
        <View style={s.pad}>
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.accentText }]}>
            <Text style={[s.title, { color: theme.textHeading }]}>{`${t("credits.mine.invitations")}: ${waiting}`}</Text>
            <PillButton theme={theme} size="compact" label={t("credits.mine.invitationsOpen")} onPress={() => router.push(href("/credit-invites"))} />
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={s.pad}>
          <InlineError theme={theme}>{say(t, error)}</InlineError>
        </View>
      ) : null}
      {mine.loading && !mine.data ? <LoadingRows theme={theme} rows={2} /> : null}
      {mine.error ? (
        <View style={s.pad}>
          <InlineError theme={theme} onRetry={mine.reload}>
            {say(t, mine.error)}
          </InlineError>
        </View>
      ) : null}
      {mine.data && rows.length === 0 ? (
        <View style={s.pad}>
          <Text style={[s.body, { color: theme.textMuted }]}>{t("credits.mine.empty")}</Text>
        </View>
      ) : null}
      <View style={s.pad}>
        {rows.map((row) => (
          <View key={row.credit_id} style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`credit-${row.credit_id}`}>
            <View style={s.line}>
              <View style={s.grow}>
                <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
                  {row.recording.title}
                </Text>
                <Text style={[s.note, { color: theme.textBody }]}>{`${kindLabel(normalizeKind(row.recording.kind))} · ${t(roleKey(CREDIT_ROLES.includes(row.role) ? row.role : "performer"))}`}</Text>
                {!row.shown ? <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.mine.hidden")}</Text> : null}
              </View>
              <Switch
                accessibilityLabel={row.shown ? t("credits.mine.hide") : t("credits.mine.show")}
                value={row.shown}
                disabled={busy !== null}
                onValueChange={(v) => void toggle(row, v)}
                trackColor={{ true: theme.brand, false: switchTrackOff(theme) }}
                thumbColor="#FFFFFF"
                {...WEB_THUMB}
              />
            </View>
            {asking === row.credit_id ? (
              <View style={s.ask} accessibilityRole="alert">
                <Text style={[s.title, { color: theme.textHeading }]}>{t("credits.mine.leaveAsk", { title: row.recording.title })}</Text>
                <Text style={[s.body, { color: theme.textBody }]}>{t("credits.mine.leaveBody")}</Text>
                <View style={s.actions}>
                  <PillButton theme={theme} size="compact" tone="line" label={t("common.cancel")} onPress={() => setAsking(null)} />
                  <PillButton theme={theme} size="compact" tone="danger" busy={busy === row.credit_id} label={t("credits.mine.leave")} onPress={() => void leave(row)} />
                </View>
              </View>
            ) : (
              <PillButton theme={theme} size="compact" tone="quiet" label={t("credits.mine.leave")} a11y={`${t("credits.mine.leave")}: ${row.recording.title}`} onPress={() => setAsking(row.credit_id)} />
            )}
          </View>
        ))}
      </View>

      <Settings theme={theme} />
    </ScrollView>
  )
}

/** "Who can name me on recordings": two answers, and the people who were blocked with "Not me, and do not let this person name me". */
function Settings({ theme }: { theme: SongsTheme }) {
  const t = useT()
  const api = creditsApi()
  const setting = useAuthorRequest(() => api.settings(), [])
  const blocks = useAuthorRequest(() => api.blocks(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chosen = setting.data?.credit_invites ?? null

  const choose = async (value: "everyone" | "nobody") => {
    if (busy || value === chosen) return
    setBusy(value)
    setError(null)
    try {
      setting.setData(await api.setSettings(value))
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const unblock = async (id: string) => {
    if (busy) return
    setBusy(id)
    setError(null)
    try {
      await api.unblock(id)
      blocks.setData((blocks.data ?? []).filter((b) => b.id !== id))
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={s.pad}>
      <SectionTitle theme={theme}>{t("credits.settings.title")}</SectionTitle>
      {setting.error ? (
        <InlineError theme={theme} onRetry={setting.reload}>
          {say(t, setting.error)}
        </InlineError>
      ) : null}
      <View style={s.group} accessibilityRole={"radiogroup" as never}>
        {(["everyone", "nobody"] as const).map((value) => {
          const on = chosen === value
          return (
            <View key={value} style={s.one}>
              <KPress accessibilityRole="radio" accessibilityState={{ checked: on, disabled: busy !== null || chosen === null }} accessibilityLabel={t(`credits.settings.${value}`)} disabled={busy !== null || chosen === null} onActivate={() => void choose(value)} pressedScale={0.99} style={s.radioRow} testID={`credit-setting-${value}`}>
                <View style={[s.radio, { borderColor: on ? amColors.orange700 : theme.textBody }]}>{on ? <View style={s.dot} /> : null}</View>
                <Text style={[s.title, { color: theme.textHeading }]}>{t(`credits.settings.${value}`)}</Text>
              </KPress>
              <Text style={[s.note, s.indent, { color: theme.textBody }]}>{t(`credits.settings.${value}Hint`)}</Text>
            </View>
          )
        })}
      </View>
      {error ? <InlineError theme={theme}>{say(t, error)}</InlineError> : null}
      <Text style={[s.title, { color: theme.textHeading }]}>{t("credits.settings.blocks")}</Text>
      {blocks.data && blocks.data.length === 0 ? <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.settings.blocksEmpty")}</Text> : null}
      {(blocks.data ?? []).map((person) => (
        <View key={person.id} style={[s.line, s.block, { borderColor: theme.line }]}>
          <Text style={[s.title, s.grow, { color: theme.textHeading }]} numberOfLines={1}>
            {person.name}
          </Text>
          <PillButton theme={theme} size="compact" tone="line" busy={busy === person.id} label={t("credits.settings.unblock", { name: person.name })} onPress={() => void unblock(person.id)} />
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 12 },
  heading: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  title: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ask: { gap: 8 },
  group: { gap: 8 },
  one: { gap: 2 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: amColors.orange700 },
  indent: { paddingLeft: 34 },
  block: { borderTopWidth: 1, paddingTop: 10 },
})
