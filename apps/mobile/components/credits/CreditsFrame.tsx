import { useEffect, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, topInset } from "@/components/account/AccountUi"
import { DemoNote, LoadingRows, StateBlock } from "@/components/authors/AuthorsUi"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { AUTHORS_HREF, BECOME_AUTHOR_HREF } from "@/lib/authors/constants"
import { isSignedIn } from "@/lib/authors/session"
import { say } from "@/lib/authors/text"
import type { AuthorProfileOwner } from "@/lib/authors/types"
import { creditsApi } from "@/lib/credits/api"
import { useT } from "@/lib/i18n"
import { useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * The frame of the credit screens: the top bar, the "sign in" state and, when `needPage` is set, the "make your author page first"
 * state (a person says yes or no to a credit on their own page, so the page has to exist). Then `children(page)`. `page` is
 * null when the screen does not need one.
 */
export function CreditsFrame({ title, needPage, children }: { title: string; needPage?: boolean; children: (page: AuthorProfileOwner | null) => ReactNode }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const api = authorsApi()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const storeError = useAuthorStore((s) => s.errorKey)
  const refresh = useAuthorStore((s) => s.refresh)
  const signedIn = isSignedIn(api)
  const wantsPage = Boolean(needPage)

  useEffect(() => {
    if (wantsPage && signedIn && load === "idle") void refresh()
  }, [wantsPage, signedIn, load, refresh])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))
  const frame = (child: ReactNode) => (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AccountBar theme={theme} title={title} onBack={back} inset={topInset(insets.top)} />
      {child}
    </View>
  )

  if (!signedIn) return frame(<StateBlock theme={theme} title={t("authors.become.signin.title")} body={t("credits.invites.signin")} action={t("authors.become.signin.action")} onAction={() => router.push(href("/signin"))} />)
  if (wantsPage && (load === "idle" || load === "loading")) return frame(<LoadingRows theme={theme} rows={3} />)
  if (wantsPage && load === "error") return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, storeError ?? "authors.error.generic")} action={t("common.tryAgain")} onAction={() => void refresh()} />)
  if (wantsPage && !mine) return frame(<StateBlock theme={theme} title={t("credits.invites.needPage.title")} body={t("credits.invites.needPage.body")} action={t("credits.invites.needPage.action")} onAction={() => router.replace(href(BECOME_AUTHOR_HREF))} />)
  return frame(
    <>
      {api.demo || creditsApi().demo ? <DemoNote theme={theme} /> : null}
      {children(wantsPage ? mine : null)}
    </>,
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
})
