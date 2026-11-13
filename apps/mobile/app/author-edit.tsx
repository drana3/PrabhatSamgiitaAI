import { useEffect, useMemo, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, InlineError, topInset } from "@/components/account/AccountUi"
import { AboutFields, LinksEditor, NameAndAddress, UploadChoices } from "@/components/authors/AuthorFormParts"
import { AuthorAvatar, DemoNote, LoadingRows, PillButton, SectionTitle, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { LeaveCard } from "@/components/authors/LeaveCard"
import { PhotoCropSheet } from "@/components/profile-v2/PhotoCropSheet"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSlugCheck } from "@/hooks/useSlugCheck"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { isSignedIn } from "@/lib/authors/session"
import { BECOME_AUTHOR_HREF, MY_AUTHOR_HREF } from "@/lib/authors/constants"
import { draftFromOwner, hasErrors, invalidFieldKeys, isDirty, toPatch, validateDraft, type Draft } from "@/lib/authors/draft"
import { errorKey as keyOfCode } from "@/lib/authors/slug"
import { say } from "@/lib/authors/text"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { pickProfileImage, renderProfilePhoto, type PickedImage } from "@/lib/profile/photo"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

/** Edit the author page: the same fields as the creation steps on one screen, the picture, and Save. */
export default function AuthorEditScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const api = authorsApi()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const refresh = useAuthorStore((s) => s.refresh)
  const setMine = useAuthorStore((s) => s.setMine)
  const signedIn = isSignedIn(api)

  const form = useFormFocus()
  const [leaving, setLeaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [cropping, setCropping] = useState<PickedImage | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (signedIn && load === "idle") void refresh()
  }, [signedIn, load, refresh])
  useEffect(() => {
    if (mine && !draft) setDraft(draftFromOwner(mine))
  }, [mine, draft])

  const slug = useSlugCheck(draft?.slug ?? "", mine?.slug ?? null)
  const errors = useMemo(() => (draft ? validateDraft(draft) : {}), [draft])
  const dirty = draft && mine ? isDirty(draft, mine) : false

  const leave = () => (router.canGoBack() ? router.back() : router.replace(href(MY_AUTHOR_HREF)))
  const back = () => (dirty ? setLeaving(true) : leave())
  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }
  const frame = (child: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AccountBar theme={theme} title={t("authors.edit.title")} onBack={back} inset={topInset(insets.top)} />
      {leaving ? <LeaveCard theme={theme} onStay={() => setLeaving(false)} onLeave={leave} /> : null}
      {child}
    </View>
  )

  if (!signedIn) return frame(<StateBlock theme={theme} title={t("authors.become.signin.title")} body={t("authors.become.signin.body")} action={t("authors.become.signin.action")} onAction={() => router.push(href("/signin"))} />)
  if (load === "idle" || load === "loading") return frame(<LoadingRows theme={theme} rows={3} />)
  if (load === "error") return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={t("authors.error.generic")} action={t("common.tryAgain")} onAction={() => void refresh()} />)
  if (!mine) return frame(<StateBlock theme={theme} title={t("authors.mine.none.title")} body={t("authors.mine.none.body")} action={t("authors.cta.become")} onAction={() => router.replace(href(BECOME_AUTHOR_HREF))} />)
  if (!draft) return frame(<LoadingRows theme={theme} rows={3} />)

  const save = async () => {
    setTouched(true)
    const slugOk = draft.slug === mine.slug || slug.kind === "ok"
    if (hasErrors(errors) || !slugOk) {
      void form.focusFirst(invalidFieldKeys(errors, slugOk))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await api.update(toPatch(draft, mine))
      setMine(updated)
      setDraft(draftFromOwner(updated))
      flash(t("authors.edit.saved"))
      if (updated.status !== mine.status || updated.review_needed !== mine.review_needed) router.replace(href(MY_AUTHOR_HREF))
    } catch (failure) {
      setError(failure instanceof NetworkError ? keyOfCode({ network: true }) : failure instanceof RemoteError ? keyOfCode({ code: failure.code, status: failure.status }) : errorKeyOf(failure))
    } finally {
      setBusy(false)
    }
  }

  const choosePhoto = async () => {
    setPhotoBusy(true)
    try {
      const picked = await pickProfileImage("library")
      if (picked.status === "ok") setCropping(picked.image)
      else if (picked.status === "error") flash(picked.message)
    } finally {
      setPhotoBusy(false)
    }
  }
  const finishCrop = async (rect: Parameters<typeof renderProfilePhoto>[1], image: PickedImage) => {
    setCropping(null)
    setPhotoBusy(true)
    try {
      const made = await renderProfilePhoto(image.uri, rect)
      if (made.status !== "ok") return flash(t("authors.error.photo_type"))
      const blob = await (await fetch(made.uri)).blob()
      const updated = await api.putPhoto(blob, "image/jpeg")
      setMine(updated)
      flash(t("authors.edit.photoSaved"))
    } catch (failure) {
      flash(say(t, errorKeyOf(failure)))
    } finally {
      setPhotoBusy(false)
    }
  }
  const removePhoto = async () => {
    setPhotoBusy(true)
    try {
      setMine(await api.removePhoto())
    } catch (failure) {
      flash(say(t, errorKeyOf(failure)))
    } finally {
      setPhotoBusy(false)
    }
  }

  return frame(
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
        <ScrollView ref={form.scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {api.demo ? <DemoNote theme={theme} /> : null}
          <View style={[styles.pad, styles.photoRow]}>
            <AuthorAvatar slug={mine.slug} name={mine.display_name} photoUrl={mine.photo_url} size={88} />
            <View style={styles.photoButtons}>
              <PillButton theme={theme} tone="line" busy={photoBusy} label={mine.photo_url ? t("authors.edit.photoChange") : t("authors.edit.photoAdd")} onPress={() => void choosePhoto()} />
              {mine.photo_url ? <PillButton theme={theme} tone="quiet" disabled={photoBusy} label={t("authors.edit.photoRemove")} onPress={() => void removePhoto()} /> : null}
            </View>
          </View>
          <View style={styles.pad}>
            <NameAndAddress theme={theme} draft={draft} errors={errors} touched={touched} slug={slug} onChange={setDraft} slugLocked={mine.slug_change_wait_days} form={form} />
          </View>
          <View style={styles.pad}>
            <AboutFields theme={theme} draft={draft} errors={errors} onChange={setDraft} form={form} />
          </View>
          <View style={styles.pad}>
            <LinksEditor theme={theme} draft={draft} errors={errors} onChange={setDraft} form={form} />
          </View>
          <View style={styles.pad}>
            <SectionTitle theme={theme}>{t("authors.edit.uploadsTitle")}</SectionTitle>
            <UploadChoices theme={theme} draft={draft} onChange={setDraft} />
          </View>
          {error ? (
            <View style={styles.pad}>
              <InlineError theme={theme}>{say(t, error)}</InlineError>
            </View>
          ) : null}
          <View style={styles.pad}>
            <Text style={[styles.hint, { color: theme.textBody }]}>{t("authors.edit.reviewNote")}</Text>
            <PillButton theme={theme} busy={busy} disabled={!dirty} label={t("common.save")} onPress={() => void save()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {cropping ? <PhotoCropSheet image={cropping} theme={theme} onCancel={() => setCropping(null)} onDone={(rect, image) => void finishCrop(rect, image)} /> : null}
      <Toast message={toast} theme={theme} />
    </>,
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 72, gap: 28 },
  pad: { paddingHorizontal: SIDE, gap: 12 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photoButtons: { flex: 1, gap: 4 },
  hint: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 21 },
})
