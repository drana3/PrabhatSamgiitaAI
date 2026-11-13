import { useCallback, useMemo, useState } from "react"
import { Text, TextInput, View } from "react-native"

import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { DeskFrame, DeskStatus, deskStyles as d, failureText } from "@/components/team-desks/DeskFrame"
import { useDeskLoad } from "@/hooks/useDeskLoad"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { teamDesks } from "@/lib/teamDesks/backend"
import { WORD_FILTERS, countsByField, filterTargets, suggestedTarget, targetLabel, wordsOf, type WordFilter } from "@/lib/teamDesks/rules"
import type { WordAction, WordItem } from "@/lib/teamDesks/types"

const NONE: WordItem[] = []
/** How many listed values the merge picker shows at once; the search narrows the rest. */
const PICK_SHOWN = 30

/**
 * The team's queue of new words: what authors wrote under "Add your own" (a main instrument, a style, a mood, a language,
 * a mantra of Others). Each card says the word, its kind, who wrote it first and on how many recordings; then Accept / Merge
 * into a listed value / Reject. Team only: the server decides, and a refusal shows the "only the team" sentence. Opened from
 * the Upload hub (docs/team-desks.md, docs/kiirtan-recording-info.md "Add your own").
 */
export default function TeamWordsScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const [filter, setFilter] = useState<WordFilter>("all")
  const [notice, setNotice] = useState<string | null>(null)
  const { status, data, reload, setData } = useDeskLoad(() => teamDesks().words.list(null), NONE, [])
  const counts = useMemo(() => countsByField(data), [data])
  const shown = useMemo(() => wordsOf(data, filter), [data, filter])

  const decided = useCallback(
    (item: WordItem, action: WordAction) => {
      setData((list) => list.filter((w) => w.id !== item.id))
      setNotice(t(`teamDesk.words.done.${action}` as "teamDesk.words.done.accept", { word: item.label }))
    },
    [setData, t],
  )

  return (
    <DeskFrame title={t("teamDesk.words.title")} lead={t("teamDesk.words.lead")}>
      <View style={d.chips} accessibilityRole="tablist" accessibilityLabel={t("teamDesk.words.filter.a11y")}>
        {WORD_FILTERS.map((f) => (
          <Chip key={f} theme={theme} label={`${t(`teamDesk.words.filter.${f}` as "teamDesk.words.filter.all")}${counts[f] > 0 ? `  ${counts[f]}` : ""}`} a11y={t(`teamDesk.words.filter.${f}` as "teamDesk.words.filter.all")} on={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      {notice ? <Hint theme={theme}>{notice}</Hint> : null}
      <DeskStatus status={status} isEmpty={data.length === 0} onRetry={reload} />
      {status === "ready" && shown.length === 0 ? <Hint theme={theme}>{t("teamDesk.words.empty")}</Hint> : null}
      {shown.map((item) => (
        <WordCard key={item.id} item={item} onDecided={decided} onGone={reload} />
      ))}
    </DeskFrame>
  )
}

function WordCard({ item, onDecided, onGone }: { item: WordItem; onDecided: (item: WordItem, action: WordAction) => void; onGone: () => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const [picking, setPicking] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<string | null>(() => suggestedTarget(item))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const similar = targetLabel(item, item.similar_to)
  const options = useMemo(() => filterTargets(item.merge_targets, query), [item.merge_targets, query])

  const run = async (action: WordAction, mergeInto?: string) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      await teamDesks().words.decide(item.id, action, { mergeInto })
      onDecided(item, action)
    } catch (error) {
      const failure = failureText(t, error)
      setProblem(failure.text)
      if (failure.gone) onGone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[d.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[d.title, { color: theme.textHeading }]} selectable>
        {item.label}
      </Text>
      <Text style={[d.pill, { color: theme.textHeading, borderColor: theme.line }]}>{t("teamDesk.words.kind", { kind: t(`teamDesk.words.filter.${item.field}` as "teamDesk.words.filter.all") })}</Text>
      <Text style={[d.meta, { color: theme.textBody }]}>{item.first_by ? t("teamDesk.words.by", { name: item.first_by }) : t("teamDesk.words.byUnknown")}</Text>
      <Text style={[d.meta, { color: theme.textBody }]}>{t("teamDesk.words.use", { recordings: item.recordings_count, people: item.people_count })}</Text>
      {similar ? <Text style={[d.meta, { color: theme.accent }]}>{t("teamDesk.words.similar", { name: similar })}</Text> : null}

      {picking ? (
        <View style={d.gap}>
          <Text style={[d.meta, { color: theme.textHeading }]}>{t("teamDesk.words.pick.label", { word: item.label })}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("teamDesk.words.pick.search")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("teamDesk.words.pick.search")}
            autoCorrect={false}
            autoCapitalize="none"
            style={[d.input, { backgroundColor: theme.page, borderColor: theme.line, color: theme.textHeading }]}
          />
          <View style={d.chips} accessibilityRole="radiogroup">
            {options.slice(0, PICK_SHOWN).map((o) => (
              <Chip key={o.code} theme={theme} label={o.label} on={target === o.code} onPress={() => setTarget(o.code)} />
            ))}
          </View>
          {options.length === 0 ? <Hint theme={theme}>{t("teamDesk.words.pick.none")}</Hint> : null}
          <View style={d.row}>
            <ActionButton theme={theme} tone="quiet" label={t("teamDesk.cancel")} onPress={() => setPicking(false)} />
            <ActionButton
              theme={theme}
              label={target ? t("teamDesk.words.pick.go", { name: targetLabel(item, target) ?? target }) : t("teamDesk.words.pick.choose")}
              disabled={busy || !target}
              busy={busy}
              onPress={() => target && void run("merge", target)}
            />
          </View>
        </View>
      ) : rejecting ? (
        <View style={d.gap}>
          <Hint theme={theme} tone="danger">{t("teamDesk.words.reject.confirm", { word: item.label })}</Hint>
          <View style={d.row}>
            <ActionButton theme={theme} tone="quiet" label={t("teamDesk.cancel")} onPress={() => setRejecting(false)} />
            <ActionButton theme={theme} label={t("teamDesk.words.reject.go")} disabled={busy} busy={busy} onPress={() => void run("reject")} />
          </View>
        </View>
      ) : (
        <>
          <View style={d.row}>
            <ActionButton theme={theme} label={t("teamDesk.words.accept")} disabled={busy} busy={busy} onPress={() => void run("accept")} />
            <ActionButton theme={theme} tone="quiet" label={t("teamDesk.words.merge")} disabled={busy} onPress={() => setPicking(true)} />
            <ActionButton theme={theme} tone="quiet" label={t("teamDesk.words.reject")} disabled={busy} onPress={() => setRejecting(true)} />
          </View>
          <Text style={[d.body, { color: theme.textMuted }]}>{t("teamDesk.words.help")}</Text>
        </>
      )}
      {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
    </View>
  )
}
