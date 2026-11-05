import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, AccountButton, AccountField, ACCOUNT_SIDE, topInset } from "@/components/account/AccountUi"
import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { ConfirmSheet, type ConfirmRequest } from "@/components/profile-v2/ConfirmSheet"
import { PhotoCropSheet } from "@/components/profile-v2/PhotoCropSheet"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useProfileIdentity } from "@/hooks/useProfileIdentity"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import type { CropRect } from "@/lib/profile/crop"
import { cameraOffered, openAppSettings, pickProfileImage, renderProfilePhoto, type PhotoSource, type PickedImage } from "@/lib/profile/photo"
import { localProfileSink } from "@/lib/profile/localSink"
import { saveProfile } from "@/lib/profile/saveProfile"
import { NAME_MAX, initialOf, isProfileDirty, normalizeName, validateName } from "@/lib/profile/validate"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

const AVATAR = 128

type PhotoNote = { text: string; settings: boolean } | null

/**
 * Edit profile (opened from the avatar and name block of the profile sheet): the round picture with
 * Change photo, Take photo and Remove photo, the name, and Save. The name is 2 to 40 characters and is
 * checked as you type; leaving with changes asks first. The picture is chosen, then framed in a round window (pan, pinch, zoom), and saved as a 512 px square JPEG.
 * Saving writes it on this phone (lib/profile/saveProfile.ts is the seam for the upload).
 * Preview only: `?as=guest` shows the guest state, `?state=` is `error`, `photo` or `denied`.
 */
export default function EditProfileScreen() {
  const t = useT()
  const router = useRouter()
  const navigation = useNavigation()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const inset = topInset(insets.top)
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ as?: string; state?: string }>()
  const identity = useProfileIdentity()
  const preview = MOCKUP_DATA ? params.state : undefined
  const signedIn = identity.signedIn && !(MOCKUP_DATA && params.as === "guest")

  const savedName = identity.editableName
  const savedPhoto = identity.photoUri
  const [name, setName] = useState(preview === "error" ? "A" : savedName)
  const [photo, setPhoto] = useState<string | null>(preview === "photo" ? PREVIEW_PHOTO : savedPhoto)
  const [touched, setTouched] = useState(preview === "error")
  const [saving, setSaving] = useState(false)
  const [busyPhoto, setBusyPhoto] = useState(false)
  const [photoNote, setPhotoNote] = useState<PhotoNote>(
    preview === "denied" ? { text: t("account.photo.photosOff"), settings: true } : null,
  )
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  // the picture just chosen, waiting for the person to frame it in the crop sheet
  const [cropping, setCropping] = useState<PickedImage | null>(null)

  const check = useMemo(() => validateName(name), [name])
  const nameError = touched && !check.ok ? check.error : null
  const dirty = isProfileDirty({ name: savedName, photoUri: savedPhoto }, { name, photoUri: photo })
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const leaveRef = useRef(false)

  // Leaving with unsaved changes (Back button, swipe, hardware back) asks first.
  useEffect(() => {
    const off = navigation.addListener("beforeRemove", (event) => {
      if (!dirtyRef.current || leaveRef.current) return
      event.preventDefault()
      setConfirm({
        title: t("account.edit.discard.title"),
        body: t("account.edit.discard.body"),
        confirmLabel: t("account.edit.discard.confirm"),
        onConfirm: () => {
          leaveRef.current = true
          navigation.dispatch(event.data.action)
        },
      })
    })
    return off
  }, [navigation])

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href("/v2/today"))), [router])

  const pick = useCallback(async (source: PhotoSource) => {
    setPhotoNote(null)
    setBusyPhoto(true)
    const result = await pickProfileImage(source)
    setBusyPhoto(false)
    if (result.status === "ok") setCropping(result.image)
    else if (result.status === "denied") {
      setPhotoNote({
        text: source === "camera" ? t("account.photo.cameraOff") : t("account.photo.photosOff"),
        settings: true,
      })
    } else if (result.status === "error") setPhotoNote({ text: result.message, settings: false })
  }, [])

  // Done in the crop sheet: cut the framed square, 512 px, JPEG.
  const finishCrop = useCallback(async (rect: CropRect, image: PickedImage) => {
    setCropping(null)
    setPhotoNote(null)
    setBusyPhoto(true)
    const result = await renderProfilePhoto(image.uri, rect)
    setBusyPhoto(false)
    if (result.status === "ok") setPhoto(result.uri)
    else if (result.status === "error") setPhotoNote({ text: result.message, settings: false })
  }, [])

  const save = useCallback(async () => {
    setTouched(true)
    const valid = validateName(name)
    if (!valid.ok || saving) return
    setSaving(true)
    const photoChanged = (photo ?? null) !== (savedPhoto ?? null)
    const result = await saveProfile(
      { name: normalizeName(name) !== normalizeName(savedName) ? name : undefined, photoUri: photoChanged ? photo : undefined },
      localProfileSink,
    )
    setSaving(false)
    if (!result.ok) return
    leaveRef.current = true
    back()
  }, [back, name, photo, saving, savedName, savedPhoto])

  const shownInitial = normalizeName(name) === normalizeName(savedName) ? identity.initial : initialOf(name)

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <AccountBar theme={theme} title={t("account.edit.title")} onBack={back} inset={inset} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {signedIn ? null : (
              <SongsReveal index={1}>
                <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.line }]}>
                  <Text style={[styles.noticeTitle, { color: theme.textHeading }]}>{t("account.edit.guestTitle")}</Text>
                  <Text style={[styles.noticeBody, { color: theme.textBody }]}>
                    {t("account.edit.guestBody")}
                  </Text>
                  <Press accessibilityRole="button" accessibilityLabel={t("account.signIn.title")} onPress={() => router.push(href("/signin"))} pressedScale={0.97} style={styles.noticeLink}>
                    <Text style={[styles.noticeLinkText, { color: theme.accent }]}>{t("account.signIn.title")}</Text>
                  </Press>
                </View>
              </SongsReveal>
            )}

            <SongsReveal index={2} style={styles.photoBlock}>
              <View style={[styles.avatar, { backgroundColor: theme.peach }]}>
                <AvatarFace
                  initial={shownInitial}
                  photoUri={photo}
                  size={AVATAR}
                  textStyle={[styles.avatarText, { color: theme.accent }]}
                />
                {busyPhoto ? (
                  <View style={styles.avatarBusy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <AccountButton
                theme={theme}
                tone="white"
                label={t("account.edit.changePhoto")}
                onPress={() => void pick("library")}
                disabled={busyPhoto}
                style={styles.changeBtn}
              />
              <View style={styles.photoLinks}>
                {cameraOffered() ? (
                  <Press accessibilityRole="button" accessibilityLabel={t("account.edit.takePhoto")} onPress={() => void pick("camera")} disabled={busyPhoto} pressedScale={0.96} style={styles.link}>
                    <Text style={[styles.linkText, { color: theme.accent }]}>{t("account.edit.takePhoto")}</Text>
                  </Press>
                ) : null}
                {photo ? (
                  <Press accessibilityRole="button" accessibilityLabel={t("account.edit.removePhoto")} onPress={() => setPhoto(null)} disabled={busyPhoto} pressedScale={0.96} style={styles.link}>
                    <Text style={[styles.linkText, { color: theme.dangerText }]}>{t("account.edit.removePhoto")}</Text>
                  </Press>
                ) : null}
              </View>
              {photoNote ? (
                <View style={styles.photoNote} accessibilityRole="alert">
                  <Text style={[styles.noteText, { color: theme.dangerText }]}>{photoNote.text}</Text>
                  {photoNote.settings ? (
                    <Press accessibilityRole="button" accessibilityLabel={t("notif.permission.openSettings")} onPress={openAppSettings} pressedScale={0.96} style={styles.link}>
                      <Text style={[styles.linkText, { color: theme.accent }]}>{t("notif.permission.openSettings")}</Text>
                    </Press>
                  ) : null}
                </View>
              ) : null}
            </SongsReveal>

            <SongsReveal index={3}>
              <AccountField
                theme={theme}
                label={t("common.name")}
                value={name}
                onChangeText={setName}
                onBlur={() => setTouched(true)}
                error={nameError}
                hint={t("account.edit.nameHint")}
                aside={Array.from(name).length >= NAME_MAX - 8 ? `${Array.from(name).length}/${NAME_MAX}` : null}
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={NAME_MAX + 20}
                onSubmitEditing={() => void save()}
              />
            </SongsReveal>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.page, borderTopColor: theme.line, paddingBottom: Platform.OS === "web" ? 20 : Math.max(insets.bottom, 12) + 8 }]}>
            <AccountButton
              theme={theme}
              label={saving ? t("common.saving") : t("common.save")}
              onPress={() => void save()}
              loading={saving}
              disabled={!dirty}
            />
          </View>
        </KeyboardAvoidingView>
        {cropping ? <PhotoCropSheet image={cropping} theme={theme} onCancel={() => setCropping(null)} onDone={(rect, image) => void finishCrop(rect, image)} /> : null}
        {confirm ? <ConfirmSheet theme={theme} request={confirm} onDismiss={() => setConfirm(null)} bottomOffset={24} /> : null}
      </View>
    </RevealClock.Provider>
  )
}

/** Preview only: a small warm gradient JPEG stands in for a chosen picture. */
const PREVIEW_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5C253"/><stop offset="0.55" stop-color="#E5610F"/><stop offset="1" stop-color="#3C5535"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="104" r="42" fill="#FFEFE4" opacity="0.92"/><path d="M40 256c0-52 39-88 88-88s88 36 88 88z" fill="#FFEFE4" opacity="0.92"/></svg>',
  )

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: ACCOUNT_SIDE, paddingTop: 12, paddingBottom: 32, gap: 28 },
  notice: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 4 },
  noticeTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  noticeBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  noticeLink: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  noticeLinkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  photoBlock: { alignItems: "center", gap: 16 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { fontFamily: amFonts.display, fontSize: 56, lineHeight: 64 },
  avatarBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center" },
  changeBtn: { alignSelf: "stretch" },
  photoLinks: { flexDirection: "row", gap: 24, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  linkText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  photoNote: { alignItems: "center", gap: 0 },
  noteText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, textAlign: "center" },
  footer: { paddingHorizontal: ACCOUNT_SIDE, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
})
