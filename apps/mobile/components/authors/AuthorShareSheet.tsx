import { useRef, useState, type ReactNode } from "react"
import { StyleSheet, Text } from "react-native"

import { photoSrc } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { ShareCardSheet } from "@/components/share/ShareCardSheet"
import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { copyAuthorLink, shareAuthor } from "@/lib/authors/share"
import { authorCardSubject, authorLinkOf, type SharedPage } from "@/lib/authors/shareCard"
import { useT } from "@/lib/i18n"
import { useShareCardT } from "@/lib/share/cardCopy"

function Row({ theme, label, icon, onPress }: { theme: SongsTheme; label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.985} style={[styles.row, { borderColor: theme.line, backgroundColor: theme.card }]}>
      {icon}
      <Text style={[styles.label, { color: theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

/**
 * What the Share button of an author page opens: "Image card" (the picture, in the card sheet), "Share link" (the
 * system share sheet with a line of text and the link) and "Copy link". The link carries the page id while the page
 * link is hidden (lib/authors/constants.ts, `authorShareKey`).
 */
export function AuthorShareSheet({ open, theme, page, flash, onClose }: { open: boolean; theme: SongsTheme; page: SharedPage | null; flash: (message: string) => void; onClose: () => void }) {
  const t = useT()
  const tc = useShareCardT()
  // the card is its own full-screen step; it keeps its page after this sheet has closed
  const [cardFor, setCardFor] = useState<SharedPage | null>(null)
  const last = useRef<SharedPage | null>(null)
  if (page) last.current = page
  const shown = page ?? last.current
  const ink = theme.textHeading

  const shareLink = async () => {
    if (!shown) return
    const outcome = await shareAuthor({ id: shown.id, slug: shown.slug, name: shown.display_name }, t("authors.share.intro", { name: shown.display_name }))
    if (outcome === "copied") flash(t("authors.share.copied"))
    if (outcome === "failed") flash(t("authors.error.generic"))
  }
  const copyLink = async () => {
    if (!shown) return
    flash((await copyAuthorLink({ id: shown.id, slug: shown.slug })) ? t("authors.share.copied") : t("authors.error.generic"))
  }
  const act = (fn: () => void | Promise<void>) => () => {
    onClose()
    void fn()
  }

  return (
    <>
      <BottomSheet open={open && Boolean(page)} onClose={onClose} theme={theme} eyebrow={t("common.share")} accessibilityLabel={t("common.share")}>
        {shown ? (
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {shown.display_name}
          </Text>
        ) : null}
        <Text style={[styles.note, { color: theme.textBody }]}>{tc("authorShare.note")}</Text>
        <Row theme={theme} label={tc("shareCard.entry")} icon={<PlayerIcon name="layers" size={22} color={ink} />} onPress={act(() => setCardFor(shown))} />
        <Row theme={theme} label={tc("authorShare.link")} icon={<PlayerIcon name="share" size={22} color={ink} />} onPress={act(shareLink)} />
        <Row theme={theme} label={tc("shareCard.copy")} icon={<PlayerIcon name="link" size={22} color={ink} />} onPress={act(copyLink)} />
      </BottomSheet>
      {cardFor ? (
        <ShareCardSheet
          subject={authorCardSubject(cardFor, photoSrc(cardFor.photo_url))}
          link={authorLinkOf(cardFor)}
          message={`${t("authors.share.intro", { name: cardFor.display_name })} ${authorLinkOf(cardFor)}`.trim()}
          onClose={() => setCardFor(null)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  row: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 14 },
})
