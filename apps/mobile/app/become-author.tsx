import { useEffect, useMemo, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, InlineError, topInset } from "@/components/account/AccountUi"
import { AuthorHero } from "@/components/authors/AuthorHero"
import { AboutFields, LinksEditor, NameAndAddress, UploadChoices } from "@/components/authors/AuthorFormParts"
import { DemoNote, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { LeaveCard } from "@/components/authors/LeaveCard"
import { PublicStatsStrip } from "@/components/authors/StatsViews"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSlugCheck } from "@/hooks/useSlugCheck"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { isSignedIn } from "@/lib/authors/session"
import { AUTHORS_HREF, CONTENT_RULES_HREF, MY_AUTHOR_HREF } from "@/lib/authors/constants"
import { emptyDraft, hasErrors, invalidFieldKeys, toCreateInput, validateDraft, type Draft } from "@/lib/authors/draft"
import { errorKey as keyOfCode } from "@/lib/authors/slug"
import { say } from "@/lib/authors/text"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

const STEPS = 4

/**
 * Become an author, in four steps: name and address (the address is checked while typing), about you, which recordings
 * and numbers, and a preview of the page exactly as it will look. Nothing is created until the last step; a page that
 * needs the team (a protected name, a claim) is saved and waits, and the screen says so.
 */
export default function BecomeAuthorScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const api = authorsApi()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const canCreate = useAuthorStore((s) => s.canCreate)
  const suspendedReason = useAuthorStore((s) => s.suspendedReason)
  const storeError = useAuthorStore((s) => s.errorKey)
  const refresh = useAuthorStore((s) => s.refresh)
  const setMine = useAuthorStore((s) => s.setMine)

  const form = useFormFocus()
  const [leaving, setLeaving] = useState(false)
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState<"publish" | "draft" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = useSlugCheck(draft.slug, null)
  const errors = useMemo(() => validateDraft(draft), [draft])
  const signedIn = isSignedIn(api)

  useEffect(() => {
    if (signedIn && load === "idle") void refresh()
  }, [signedIn, load, refresh])
  useEffect(() => {
    if (mine) router.replace(href(MY_AUTHOR_HREF))
  }, [mine, router])

  const leave = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))
  const started = Boolean(draft.displayName.trim() || draft.bio.trim() || draft.about.trim())
  const back = () => (step > 1 ? setStep(step - 1) : started ? setLeaving(true) : leave())
  const bar = <AccountBar theme={theme} title={t("authors.become.title")} onBack={back} inset={topInset(insets.top)} />
  const frame = (child: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {bar}
      {leaving ? <LeaveCard theme={theme} onStay={() => setLeaving(false)} onLeave={leave} /> : null}
      {child}
    </View>
  )

  if (!signedIn) return frame(<StateBlock theme={theme} title={t("authors.become.signin.title")} body={t("authors.become.signin.body")} action={t("authors.become.signin.action")} onAction={() => router.push(href("/signin"))} />)
  if (load === "idle" || load === "loading") return frame(<LoadingRows theme={theme} rows={3} />)
  if (load === "error") return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, storeError ?? "authors.error.generic")} action={t("common.tryAgain")} onAction={() => void refresh()} />)
  if (!canCreate) return frame(<StateBlock theme={theme} tone="error" title={t("authors.become.suspended.title")} body={suspendedReason ? t("authors.become.suspended.reason", { reason: suspendedReason }) : t("authors.become.suspended.body")} />)

  const stepOk = (n: number): boolean => {
    if (n === 1) return !errors.name && !errors.slug && slug.kind === "ok"
    if (n === 2) return !errors.bio && !errors.about && !errors.place && !errors.links
    return true
  }
  const next = () => {
    setTouched(true)
    setError(null)
    if (!stepOk(step)) {
      void form.focusFirst(invalidFieldKeys(errors, step !== 1 || slug.kind === "ok"))
      return
    }
    setTouched(false)
    setStep(step + 1)
  }

  const submit = async (publish: boolean) => {
    if (hasErrors(errors)) return
    setBusy(publish ? "publish" : "draft")
    setError(null)
    try {
      const created = await api.create(toCreateInput(draft, publish))
      setMine(created)
      router.replace(href(MY_AUTHOR_HREF))
    } catch (failure) {
      if (failure instanceof RemoteError && failure.code?.startsWith("slug_")) setStep(1)
      setError(failure instanceof NetworkError ? keyOfCode({ network: true }) : failure instanceof RemoteError ? keyOfCode({ code: failure.code, status: failure.status }) : errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const place = [draft.city, draft.country].filter((p) => p.trim()).join(", ")

  return frame(
    <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
      <ScrollView ref={form.scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {api.demo ? <DemoNote theme={theme} /> : null}
        <View style={styles.pad}>
          <Text style={[styles.progress, { color: theme.textMuted }]} accessibilityLiveRegion="polite">
            {t("authors.become.step", { step, total: STEPS })}
          </Text>
          <Text style={[styles.heading, { color: theme.textHeading }]} accessibilityRole="header">
            {t(`authors.become.step${step as 1 | 2 | 3 | 4}.title`)}
          </Text>
          <Text style={[styles.lead, { color: theme.textBody }]}>{t(`authors.become.step${step as 1 | 2 | 3 | 4}.body`)}</Text>
        </View>

        <View style={styles.pad}>
          {step === 1 ? <NameAndAddress theme={theme} draft={draft} errors={errors} touched={touched} slug={slug} onChange={setDraft} form={form} /> : null}
          {step === 2 ? (
            <View style={styles.stack}>
              <AboutFields theme={theme} draft={draft} errors={errors} onChange={setDraft} form={form} />
              <LinksEditor theme={theme} draft={draft} errors={errors} onChange={setDraft} form={form} />
            </View>
          ) : null}
          {step === 3 ? <UploadChoices theme={theme} draft={draft} onChange={setDraft} /> : null}
        </View>

        {step === 4 ? (
          <View style={styles.stack}>
            <View style={[styles.previewFrame, { borderColor: theme.line }]} accessibilityLabel={t("authors.preview.label")}>
              <AuthorHero theme={theme} top={0} data={{ slug: draft.slug, name: draft.displayName.trim(), type: draft.authorType, verified: false, place, photoUrl: null, meta: t("authors.count.recordings", { count: 0 }) }} />
              <View style={styles.previewBody}>
                {draft.bio.trim() ? <Text style={[styles.previewBio, { color: theme.textHeading }]}>{draft.bio.trim()}</Text> : null}
                <PublicStatsStrip theme={theme} stats={draft.showStats ? { enough_data: false, counting_since: null, monthly_listeners: null, total_plays: null } : null} demo={false} />
                <Text style={[styles.hint, { color: theme.textBody }]}>{t("authors.preview.empty")}</Text>
              </View>
            </View>
            <View style={styles.pad}>
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("authors.preview.indexNote")}</Text>
              <Text style={[styles.hint, { color: theme.textBody }]}>
                {t("authors.preview.rules")}{" "}
                <Text style={{ color: theme.accentText, fontFamily: amFonts.semi }} accessibilityRole="link" onPress={() => router.push(href(CONTENT_RULES_HREF))}>
                  {t("authors.preview.rulesLink")}
                </Text>
              </Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.pad}>
            <InlineError theme={theme}>{say(t, error)}</InlineError>
          </View>
        ) : null}

        <View style={[styles.pad, styles.buttons]}>
          {step < STEPS ? (
            <PillButton theme={theme} label={t("common.continue")} onPress={next} disabled={step === 1 && slug.kind === "checking"} />
          ) : (
            <>
              <PillButton theme={theme} busy={busy === "publish"} disabled={busy === "draft"} label={t("authors.become.publish")} onPress={() => void submit(true)} />
              <PillButton theme={theme} tone="line" busy={busy === "draft"} disabled={busy === "publish"} label={t("authors.become.saveDraft")} onPress={() => void submit(false)} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>,
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 64, gap: 20 },
  pad: { paddingHorizontal: SIDE, gap: 10 },
  stack: { gap: 24 },
  progress: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  heading: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.8, textTransform: "uppercase" },
  lead: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  buttons: { gap: 10 },
  previewFrame: { marginHorizontal: SIDE, borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  previewBody: { padding: 16, gap: 12 },
  previewBio: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 25 },
  hint: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 21 },
})
