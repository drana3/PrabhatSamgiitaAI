import { useState } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"
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
import { api } from "@/lib/client"
import { companionReceivesMemberQuota } from "@/lib/chat"
import { languageSummary } from "@/lib/languageSheet"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { getCachedMemberEmail } from "@/lib/memberEmail"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { NAV_V2_TABS } from "@/lib/navV2"
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
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

const LEARN_HREF = NAV_V2_TABS.find((tab) => tab.id === "learn")?.href ?? "/v2/learn"

/**
 * `.avatar` at 64dp with 28dp initial (or the person's picture), the name in `.t-h3` at 28dp capitals, the subtitle
 * `.muted` 14 / 500. The whole block opens Edit profile.
 */
function ProfileHeader({ p, identity, onPress }: { p: AmProto; identity: ProfileView; onPress: () => void }) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`${identity.title}. Edit profile`}
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
  const script = useSongPageStore((st) => st.script)
  const translations = useSongPageStore((st) => st.translations)
  const storage = useDownloadsStorage()
  const remindersOn = useNotificationSettingsStore((st) => anyEnabled(st))
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const identity = useProfileIdentity()
  const signedIn = MOCKUP_DATA || mode === "signed_in"
  const accountId = getAccountId(mode, email)
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
      title: "Clear chat history?",
      body: memberAuthAvailable()
        ? "This clears all AI chat history on this device and on your member account, including song-page conversations."
        : "This removes saved AI conversations for your account on this device.",
      confirmLabel: "Clear history",
      onConfirm: () => {
        void (async () => {
          clearAccountMemory(accountId)
          try {
            if (memberAuthAvailable()) await api.clearMemberChat()
            Alert.alert("Cleared", "Your AI chat history was cleared.")
          } catch {
            Alert.alert("Not cleared online", "It was cleared on this device. Try again later to clear it on your account.")
          }
        })()
      },
    })

  const requestDelete = () =>
    MOCKUP_DATA ? undefined : setConfirm({
      title: "Delete account data?",
      body: "This permanently removes your member profile, saved songs, quiz progress and chat history. This cannot be undone.",
      confirmLabel: "Delete my data",
      onConfirm: () => {
        void (async () => {
          clearAccountMemory(accountId)
          try {
            if (memberAuthAvailable()) await api.deleteMemberAccount()
          } catch {
            Alert.alert("Could not delete online", "Your data is still on the server. Please try again.")
            return
          }
          await completeMemberSignOut()
          router.replace(href("/welcome"))
        })()
      },
    })

  const signOut = () => {
    if (MOCKUP_DATA) return
    void completeMemberSignOut()
    router.replace(href("/welcome"))
  }

  const body = (
    <>
      <ProfileHeader p={p} identity={identity} onPress={() => go(PROFILE_ROUTES.editProfile)} />

      {/* Your library: closes this sheet and opens the page, so Back returns to the screen under it */}
      <Group p={p}>
        <LibraryEntryRow p={p} onPress={() => swapTo(PROFILE_ROUTES.library)} />
      </Group>

      <SheetTitle p={p} label="Member" spaced />
      <Group p={p}>
        <SetRow p={p} label="Quiz and certificates" value="None yet" onPress={() => router.navigate(href(LEARN_HREF))} />
      </Group>

      <SheetTitle p={p} label="Offline" spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label="Storage and downloads"
          value={MOCKUP_DATA ? "16.9 MB" : storageRowValue(storage.bytes, storage.fileCount)}
          onPress={() => go(PROFILE_ROUTES.downloads)}
        />
      </Group>

      <SheetTitle p={p} label="Preferences" spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label="Appearance"
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
        <SetRow p={p} label="Language" value="English" />
        <SetRow
          p={p}
          label="Script and translations"
          value={languageSummary(script, translations)}
          onPress={() => swapTo(PROFILE_ROUTES.scriptAndTranslations)}
        />
        <SetRow
          p={p}
          label="Word review style"
          value={reviewStyleRowValue(reviewStyle)}
          onPress={() => swapTo(PROFILE_ROUTES.reviewStyle)}
        />
        <SetRow
          p={p}
          label="Notifications"
          value={remindersOn ? "On" : "Off"}
          chevron
          onPress={() => go("/notification-settings")}
        />
      </Group>

      <SheetTitle p={p} label="Account" spaced />
      <Group p={p}>
        {signedIn ? (
          <SetRow p={p} label="Sign out" onPress={signOut} />
        ) : (
          <SetRow p={p} label="Sign in or create an account" chevron onPress={() => go(PROFILE_ROUTES.signIn)} />
        )}
        {signedIn ? <SetRow p={p} label="Delete account data" danger onPress={requestDelete} /> : null}
      </Group>

      <SheetTitle p={p} label="More" spaced />
      <Group p={p}>
        <SetRow
          p={p}
          label="Questions to the assistant"
          value={
            MOCKUP_DATA
              ? "10 a day"
              : assistantLimitLabel(
                  memberQuota,
                  AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
                  AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
                )
          }
        />
        {signedIn ? <SetRow p={p} label="Clear chat history" onPress={requestClearChat} /> : null}
        <SetRow p={p} label="Send feedback" chevron onPress={() => go(PROFILE_ROUTES.feedback)} />
        <SetRow
          p={p}
          label="About Prabhat Samgiita"
          value={versionLabel(Constants.expoConfig?.version)}
          chevron
          onPress={() => go(PROFILE_ROUTES.about)}
        />
      </Group>

      <Text style={[s.footer, { color: p.ink500 }]}>Prabhat Samgiita · mobile</Text>
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
