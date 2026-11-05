import { useState } from "react"
import { Alert, Linking, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { ChevronRight } from "lucide-react-native"
import Constants from "expo-constants"
import {
  AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
  AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
} from "@prabhat/core"

import { ConfirmSheet, type ConfirmRequest } from "@/components/profile-v2/ConfirmSheet"
import { LibraryEntryRow } from "@/components/profile-v2/LibraryEntryRow"
import { Chip, ChipRow, Group, SetRow, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { useDownloadsStorage } from "@/components/profile-v2/useDownloadsStorage"
import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useProfileIdentity, type ProfileView } from "@/hooks/useProfileIdentity"
import { deleteAccount } from "@/lib/accountDeletion"
import { isConsentValid } from "@/lib/aiConsent"
import { api } from "@/lib/client"
import { companionReceivesMemberQuota } from "@/lib/chat"
import { languageSummary } from "@/lib/languageSheet"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { getCachedMemberEmail } from "@/lib/memberEmail"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { privacyUrl } from "@/lib/webLinks"
import {
  PROFILE_ROUTES,
  assistantLimitLabel,
  reviewStyleRowValue,
  storageRowValue,
  versionLabel,
  type ProfileRoute,
} from "@/lib/profileSheet"
import { anyEnabled } from "@/lib/notifications/settings"
import { completeMemberSignOut } from "@/lib/session"
import { APPEARANCE_LABELS, APPEARANCE_PREFERENCES } from "@/lib/appearance"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { useLanguageStore } from "@/stores/languageStore"
import { LANGUAGE_NATIVE_NAMES, formatNumber, useLanguage, useT } from "@/lib/i18n"
import { effectiveTranslations } from "@/lib/songPage/lyricLanguages"
import { useAiConsentStore } from "@/stores/aiConsentStore"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"


/**
 * `.avatar` at 64dp with 28dp initial (or the person's picture), the name in `.t-h3` at 28dp capitals, the subtitle
 * `.muted` 14 / 500. The whole block opens Edit profile.
 */
function ProfileHeader({ p, identity, onPress }: { p: AmProto; identity: ProfileView; onPress: () => void }) {
  const t = useT()
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={t("profile.header.a11y", { name: identity.title })}
      onPress={onPress}
      pressedScale={0.98}
      style={s.header}
    >
      <View style={[s.avatar, { backgroundColor: p.orange100 }]}>
        <AvatarFace initial={identity.initial} photoUri={identity.photoUri} size={64} textStyle={[s.avatarText, { color: p.orange700 }]} />
      </View>
      <View style={s.who}>
        <Text style={[s.name, { color: p.ink800 }]} numberOfLines={1} accessibilityRole="header">
          {identity.title}
        </Text>
        {identity.subtitle ? (
          <Text style={[s.subtitle, { color: p.ink500 }]} numberOfLines={1}>
            {identity.subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={p.ink500} strokeWidth={1.9} />
    </TodayPress>
  )
}

/**
 * Body of the profile sheet (prototype PROFILE SHEET, Main.dc.html 2247-2288): the account header, then
 * Member, Offline, Preferences and Account groups and the footer line. Rows the prototype does not
 * have but the app needs (assistant limit, clear chat history, Send feedback, About) sit in a
 * quiet "More" group under Account, the same in the preview and in real builds.
 */
export function useProfileContent(theme: AmTheme) {
  const p = protoFor(theme)
  const router = useRouter()
  const mode = useAuthStore((st) => st.mode)
  const email = useAuthStore((st) => st.email)
  const memberId = useAuthStore((st) => st.memberId)
  const getAccountId = useChatStore((st) => st.getAccountId)
  const clearAccountMemory = useChatStore((st) => st.clearAccountMemory)
  const appearance = useAppearanceStore((st) => st.appearance)
  const setAppearance = useAppearanceStore((st) => st.setAppearance)
  const reviewStyle = useAppearanceStore((st) => st.reviewStyle)
  const t = useT()
  const languagePref = useLanguageStore((st) => st.language)
  const script = useSongPageStore((st) => st.script)
  const storedTranslations = useSongPageStore((st) => st.translations)
  const appLanguage = useLanguage()
  // nothing chosen yet means the language of the app
  const translations = effectiveTranslations(storedTranslations, appLanguage)
  const storage = useDownloadsStorage()
  const remindersOn = useNotificationSettingsStore((st) => anyEnabled(st))
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const aiAllowed = useAiConsentStore((st) => isConsentValid(st))

  const identity = useProfileIdentity()
  const signedIn = MOCKUP_DATA || mode === "signed_in"
  // admin tools are for admins only, and the server checks again: this only hides the way in
  const isAdmin = useAuthStore((st) => st.isAdmin) && mode === "signed_in"
  const accountId = getAccountId(mode, email, memberId)
  const memberQuota = companionReceivesMemberQuota({
    signedIn,
    memberAuthReady: memberAuthAvailable(),
    memberId,
    email,
    cachedEmail: getCachedMemberEmail(),
  })

  const go = (route: ProfileRoute | string) => router.push(href(route))
  /** the prototype swaps the profile sheet for the next one */
  const swapTo = (route: ProfileRoute) => router.replace(href(route))

  const requestClearChat = () =>
    setConfirm({
      title: t("profile.clearChat.title"),
      body: memberAuthAvailable() ? t("profile.clearChat.bodyMember") : t("profile.clearChat.bodyLocal"),
      confirmLabel: t("profile.clearChat.confirm"),
      onConfirm: () => {
        void (async () => {
          clearAccountMemory(accountId)
          try {
            if (memberAuthAvailable()) await api.clearMemberChat()
            Alert.alert(t("profile.clearChat.doneTitle"), t("profile.clearChat.doneBody"))
          } catch {
            Alert.alert(t("profile.clearChat.partialTitle"), t("profile.clearChat.partialBody"))
          }
        })()
      },
    })

  const requestDelete = () =>
    MOCKUP_DATA ? undefined : setConfirm({
      title: t("profile.delete.title"),
      body: t("profile.delete.body"),
      confirmLabel: t("profile.delete.confirm"),
      onConfirm: () => {
        void (async () => {
          // The server decides: only a confirmed deletion clears this phone and signs out.
          const result = await deleteAccount(accountId)
          if (!result.ok) {
            Alert.alert(
              t("profile.delete.failTitle"),
              result.reason === "unavailable" ? t("profile.delete.unavailableBody") : t("profile.delete.failBody"),
            )
            return
          }
          router.replace(href("/welcome"))
          Alert.alert(t("profile.delete.doneTitle"), t("profile.delete.doneBody"))
        })()
      },
    })

  /** The person can take the AI consent back; the next question asks again. */
  const requestRevokeAi = () =>
    setConfirm({
      title: t("profile.aiConsent.revoke.title"),
      body: t("profile.aiConsent.revoke.body"),
      confirmLabel: t("profile.aiConsent.revoke.confirm"),
      onConfirm: () => useAiConsentStore.getState().revoke(),
    })

  const doSignOut = () => {
    void completeMemberSignOut()
    router.replace(href("/welcome"))
  }

  /** Asks first, and says what happens to the downloaded songs: they stay on the phone. */
  const signOut = () => {
    if (MOCKUP_DATA) return
    setConfirm({
      title: t("profile.signOut.confirm.title"),
      body: t("profile.signOut.confirm.body"),
      confirmLabel: t("profile.signOut.confirm.confirm"),
      onConfirm: doSignOut,
    })
  }

  const body = (
    <>
      <ProfileHeader p={p} identity={identity} onPress={() => go(PROFILE_ROUTES.editProfile)} />

      {/* Your library: closes this sheet and opens the page, so Back returns to the screen under it */}
      <Group p={p}>
        <LibraryEntryRow p={p} onPress={() => swapTo(PROFILE_ROUTES.library)} />
      </Group>

      {/* "Quiz and certificates" row hidden for now (Dada 2026-11-05), see lib/learn/hub.ts */}

      <SheetTitle p={p} label={t("profile.section.offline")} spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label={t("profile.storage")}
          value={MOCKUP_DATA ? `${formatNumber(16.9, { maximumFractionDigits: 1 })} ${t("unit.mb")}` : storageRowValue(storage.bytes, storage.fileCount)}
          onPress={() => go(PROFILE_ROUTES.downloads)}
        />
      </Group>

      <SheetTitle p={p} label={t("profile.section.preferences")} spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label={t("profile.appearance")}
          right={
            <ChipRow>
              {APPEARANCE_PREFERENCES.filter((option) => !MOCKUP_DATA || option !== "auto").map((option) => (
                <Chip
                  key={option}
                  p={p}
                  label={APPEARANCE_LABELS[option]}
                  on={appearance === option}
                  onPress={() => setAppearance(option)}
                />
              ))}
            </ChipRow>
          }
        />
        <SetRow
          p={p}
          label={t("profile.language")}
          value={languagePref === "auto" ? t("language.auto") : LANGUAGE_NATIVE_NAMES[languagePref]}
          onPress={() => swapTo(PROFILE_ROUTES.language)}
        />
        <SetRow
          p={p}
          label={t("profile.scriptAndTranslations")}
          value={languageSummary(script, translations)}
          onPress={() => swapTo(PROFILE_ROUTES.scriptAndTranslations)}
        />
        <SetRow
          p={p}
          label={t("profile.reviewStyle")}
          value={reviewStyleRowValue(reviewStyle)}
          onPress={() => swapTo(PROFILE_ROUTES.reviewStyle)}
        />
        <SetRow
          p={p}
          label={t("profile.notifications")}
          value={remindersOn ? t("common.on") : t("common.off")}
          chevron
          onPress={() => go("/notification-settings")}
        />
      </Group>

      <SheetTitle p={p} label={t("profile.section.account")} spaced />
      <Group p={p}>
        {signedIn ? (
          <SetRow p={p} label={t("profile.signOut")} onPress={signOut} />
        ) : (
          <SetRow p={p} label={t("profile.signIn")} chevron onPress={() => go(PROFILE_ROUTES.signIn)} />
        )}
        {signedIn ? <SetRow p={p} label={t("profile.deleteData")} danger onPress={requestDelete} /> : null}
      </Group>

      <SheetTitle p={p} label={t("profile.section.more")} spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label={t("profile.assistant")}
          value={
            MOCKUP_DATA
              ? t("profile.assistant.perDay", { count: 10 })
              : assistantLimitLabel(
                  memberQuota,
                  AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
                  AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
                )
          }
        />
        <SetRow
          p={p}
          label={t("profile.aiConsent")}
          value={aiAllowed ? t("profile.aiConsent.on") : t("profile.aiConsent.off")}
          chevron={aiAllowed}
          onPress={aiAllowed ? requestRevokeAi : undefined}
        />
        {signedIn ? <SetRow p={p} label={t("profile.clearChat")} onPress={requestClearChat} /> : null}
        <SetRow p={p} label={t("profile.feedback")} chevron onPress={() => go(PROFILE_ROUTES.feedback)} />
        <SetRow p={p} label={t("profile.privacy")} chevron onPress={() => Linking.openURL(privacyUrl()).catch(() => undefined)} />
        <SetRow p={p} label={t("ugc.rules.title")} chevron onPress={() => go(PROFILE_ROUTES.contentRules)} />
        {isAdmin ? <SetRow p={p} label={t("profile.admin")} chevron onPress={() => go(PROFILE_ROUTES.admin)} /> : null}
        <SetRow
          p={p}
          label={t("profile.about")}
          value={versionLabel(Constants.expoConfig?.version)}
          chevron
          onPress={() => go(PROFILE_ROUTES.about)}
        />
      </Group>

      <Text style={[s.footer, { color: p.ink500 }]}>{t("profile.footer")}</Text>
    </>
  )

  const overlay = <ConfirmSheet theme={theme} request={confirm} onDismiss={() => setConfirm(null)} />
  return { body, overlay, p }
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { fontFamily: amFonts.bold, fontSize: 28, lineHeight: 40.6 },
  who: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    fontFamily: amFonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.56,
    textTransform: "uppercase",
  },
  subtitle: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20.3 },
  footer: { paddingHorizontal: 20, paddingTop: 16, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18.85 },
})
