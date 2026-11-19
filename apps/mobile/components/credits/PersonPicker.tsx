import { useEffect, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { AccountField } from "@/components/account/AccountUi"
import { AuthorAvatar } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorsApi } from "@/lib/authors/api"
import type { AuthorCardData } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { NAME_MAX, tidyName } from "@/lib/kirtan/credits"

/** Wait after the last keystroke before the directory is asked, and the fewest letters worth asking about. */
const DELAY_MS = 350
const MIN_LETTERS = 2
const SHOWN = 6

/** What the picker hands back: a page (with its id, when the server told it) or a plain name. */
export type PickedPerson = { name: string; profileId: string | null; slug: string | null; lookupFailed: boolean }

/**
 * "Find an author page, or write a name": one search field, the pages that match, and a button that takes the typed words as a
 * plain name. A directory card has no page id, so choosing one asks the public page for it; when that fails the person is
 * added as a plain name and the caller says so (`lookupFailed`). Holds no list: the caller keeps the people.
 */
export function PersonPicker({ theme, onPick, disabled, skipSlugs }: { theme: SongsTheme; onPick: (person: PickedPerson) => void; disabled?: boolean; skipSlugs?: readonly string[] }) {
  const t = useT()
  const [text, setText] = useState("")
  const [found, setFound] = useState<AuthorCardData[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const ticket = useRef(0)
  const q = tidyName(text)

  useEffect(() => {
    if (q.length < MIN_LETTERS) {
      ticket.current += 1
      setFound(null)
      setBusy(false)
      return undefined
    }
    const mine = ++ticket.current
    const timer = setTimeout(() => {
      setBusy(true)
      authorsApi()
        .directory({ q, limit: SHOWN })
        .then(
          (page) => {
            if (mine !== ticket.current) return
            setFound(page.items)
            setBusy(false)
          },
          () => {
            if (mine !== ticket.current) return
            setFound([])
            setBusy(false)
          },
        )
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [q])

  const clear = () => {
    ticket.current += 1
    setText("")
    setFound(null)
  }

  const choose = async (card: AuthorCardData) => {
    if (resolving || disabled) return
    setResolving(card.slug)
    let profileId: string | null = null
    try {
      const lookup = await authorsApi().profile(card.slug)
      profileId = lookup.kind === "profile" ? (lookup.profile.id ?? null) : null
    } catch {
      profileId = null
    }
    setResolving(null)
    onPick({ name: card.display_name, profileId, slug: profileId ? card.slug : null, lookupFailed: profileId === null })
    clear()
  }

  const write = () => {
    if (disabled) return
    onPick({ name: q, profileId: null, slug: null, lookupFailed: false })
    clear()
  }

  const items = (found ?? []).filter((c) => !skipSlugs?.includes(c.slug))
  const asked = q.length >= MIN_LETTERS

  return (
    <View style={s.root} testID="person-picker">
      <AccountField theme={theme} label={t("credits.people.search")} placeholder={t("credits.people.searchPlaceholder")} value={text} onChangeText={setText} maxLength={NAME_MAX} autoCapitalize="words" autoCorrect={false} returnKeyType="search" editable={!disabled} />
      {asked && busy ? <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.people.searching")}</Text> : null}
      {items.map((card) => (
        <KPress
          key={card.slug}
          accessibilityRole="button"
          accessibilityLabel={card.display_name}
          accessibilityState={{ disabled: Boolean(disabled || resolving), busy: resolving === card.slug }}
          disabled={disabled || Boolean(resolving)}
          onActivate={() => void choose(card)}
          pressedScale={0.98}
          style={[s.card, { backgroundColor: theme.card, borderColor: theme.line, opacity: resolving && resolving !== card.slug ? 0.5 : 1 }]}
          testID={`person-found-${card.slug}`}
        >
          <AuthorAvatar slug={card.slug} name={card.display_name} photoUrl={card.photo_url} size={40} />
          <View style={s.cardText}>
            <Text style={[s.name, { color: theme.textHeading }]} numberOfLines={1}>
              {card.display_name}
            </Text>
            <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.people.pageWillAsk")}</Text>
          </View>
        </KPress>
      ))}
      {asked && !busy && found !== null && items.length === 0 ? <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.people.noPage")}</Text> : null}
      {asked ? (
        <View style={s.write}>
          <KPress accessibilityRole="button" accessibilityLabel={t("credits.people.write", { name: q })} disabled={disabled} onActivate={write} pressedScale={0.98} style={[s.writeButton, { borderColor: theme.line }]} testID="person-write">
            <Text style={[s.writeText, { color: theme.textHeading }]} numberOfLines={1}>
              {t("credits.people.write", { name: q })}
            </Text>
          </KPress>
          <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.people.writeHint")}</Text>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 10 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 8, paddingRight: 14, borderRadius: 16, borderWidth: 1 },
  cardText: { flex: 1, gap: 1 },
  name: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  write: { gap: 6 },
  writeButton: { minHeight: 44, borderRadius: 22, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16 },
  writeText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
