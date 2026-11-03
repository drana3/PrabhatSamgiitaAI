import { useState } from "react"
import { Alert } from "react-native"
import { useRouter } from "expo-router"
import Constants from "expo-constants"
import {
  Eraser,
  HardDriveDownload,
  Info,
  Languages,
  LogIn,
  LogOut,
  MessageSquareHeart,
  Repeat,
  Sparkles,
  SunMoon,
  Trash2,
} from "lucide-react-native"
import {
  AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
  AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
} from "@prabhat/core"

import { AccountHeader, AppearanceControl, Group, Hairline, Row, SectionLabel } from "@/components/profile-v2/Rows"
import { ConfirmSheet, type ConfirmRequest } from "@/components/profile-v2/ConfirmSheet"
import { useDownloadsStorage } from "@/components/profile-v2/useDownloadsStorage"
import { Reveal } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { api } from "@/lib/client"
import { companionReceivesMemberQuota } from "@/lib/chat"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { getCachedMemberEmail } from "@/lib/memberEmail"
import {
  PROFILE_ROUTES,
  assistantLimitLabel,
  buildProfileIdentity,
  isRouteReady,
  reviewStyleRowValue,
  storageRowValue,
  versionLabel,
  type ProfileRoute,
} from "@/lib/profileSheet"
import { completeMemberSignOut } from "@/lib/session"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { href } from "@/utils/href"

/**
 * Sections of the profile sheet (spec SCR-14): Account, Reading, Learning,
 * Listening, Assistant, About, Feedback, and a Danger zone set apart by a rule.
 * Every row has its own icon. Rows whose screen is built on another branch
 * are shown inert (see PROFILE_ROUTE_READY) rather than linked to nothing.
 */
export function useProfileContent(theme: AmTheme) {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const memberId = useAuthStore((s) => s.memberId)
  const getAccountId = useChatStore((s) => s.getAccountId)
  const clearAccountMemory = useChatStore((s) => s.clearAccountMemory)
  const appearance = useAppearanceStore((s) => s.appearance)
  const setAppearance = useAppearanceStore((s) => s.setAppearance)
  const reviewStyle = useAppearanceStore((s) => s.reviewStyle)
  const storage = useDownloadsStorage()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const identity = buildProfileIdentity({ mode, displayName, email })
  const signedIn = mode === "signed_in"
  const accountId = getAccountId(mode, email)
  const memberQuota = companionReceivesMemberQuota({
    signedIn,
    memberAuthReady: memberAuthAvailable(),
    memberId,
    email,
    cachedEmail: getCachedMemberEmail(),
  })

  const go = (route: ProfileRoute | string) => router.push(href(route))
  const goIfReady = (route: ProfileRoute) => (isRouteReady(route) ? () => go(route) : undefined)

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
    setConfirm({
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
    void completeMemberSignOut()
    router.replace(href("/welcome"))
  }

  const body = (
    <>
      <Reveal index={0}>
        <AccountHeader
          theme={theme}
          initial={identity.initial}
          title={identity.title}
          subtitle={identity.subtitle}
        />
      </Reveal>

      <Reveal index={1}>
        <Group theme={theme}>
          {signedIn ? (
            <Row
              theme={theme}
              icon={<LogOut size={18} color={theme.textBody} />}
              label="Sign out"
              noChevron
              onPress={signOut}
            />
          ) : (
            <Row
              theme={theme}
              icon={<LogIn size={18} color={theme.textBody} />}
              label="Sign in or create an account"
              onPress={() => go(PROFILE_ROUTES.signIn)}
            />
          )}
        </Group>
      </Reveal>

      <Reveal index={2}>
        <SectionLabel theme={theme}>Reading</SectionLabel>
        <Group theme={theme}>
          <Row
            theme={theme}
            icon={<Languages size={18} color={theme.textBody} />}
            label="Script and translations"
            value={isRouteReady(PROFILE_ROUTES.scriptAndTranslations) ? undefined : "Soon"}
            disabled={!isRouteReady(PROFILE_ROUTES.scriptAndTranslations)}
            onPress={goIfReady(PROFILE_ROUTES.scriptAndTranslations)}
          />
          <Hairline theme={theme} />
          <Row
            theme={theme}
            icon={<SunMoon size={18} color={theme.textBody} />}
            label="Appearance"
            noChevron
            onPress={undefined}
          />
          <AppearanceControl theme={theme} value={appearance} onChange={setAppearance} />
        </Group>
      </Reveal>

      <Reveal index={3}>
        <SectionLabel theme={theme}>Learning</SectionLabel>
        <Group theme={theme}>
          <Row
            theme={theme}
            icon={<Repeat size={18} color={theme.textBody} />}
            label="Review style"
            value={reviewStyleRowValue(reviewStyle)}
            disabled={!isRouteReady(PROFILE_ROUTES.reviewStyle)}
            onPress={goIfReady(PROFILE_ROUTES.reviewStyle)}
          />
        </Group>
      </Reveal>

      <Reveal index={4}>
        <SectionLabel theme={theme}>Listening</SectionLabel>
        <Group theme={theme}>
          <Row
            theme={theme}
            icon={<HardDriveDownload size={18} color={theme.textBody} />}
            label="Storage and downloads"
            value={storageRowValue(storage.bytes, storage.fileCount)}
            disabled={!isRouteReady(PROFILE_ROUTES.downloads)}
            onPress={goIfReady(PROFILE_ROUTES.downloads)}
          />
        </Group>
      </Reveal>

      <Reveal index={5}>
        <SectionLabel theme={theme}>Assistant</SectionLabel>
        <Group theme={theme}>
          <Row
            theme={theme}
            icon={<Sparkles size={18} color={theme.textBody} />}
            label="Questions"
            value={assistantLimitLabel(
              memberQuota,
              AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
              AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
            )}
            noChevron
          />
          {signedIn ? (
            <>
              <Hairline theme={theme} />
              <Row
                theme={theme}
                icon={<Eraser size={18} color={theme.textBody} />}
                label="Clear chat history"
                noChevron
                onPress={requestClearChat}
              />
            </>
          ) : null}
        </Group>
      </Reveal>

      <Reveal index={6}>
        <SectionLabel theme={theme}>About</SectionLabel>
        <Group theme={theme}>
          <Row
            theme={theme}
            icon={<Info size={18} color={theme.textBody} />}
            label="About Prabhat Samgiita"
            value={versionLabel(Constants.expoConfig?.version)}
            onPress={() => go(PROFILE_ROUTES.about)}
          />
          <Hairline theme={theme} />
          <Row
            theme={theme}
            icon={<MessageSquareHeart size={18} color={theme.textBody} />}
            label="Send feedback"
            onPress={() => go(signedIn ? PROFILE_ROUTES.feedback : PROFILE_ROUTES.signIn)}
          />
        </Group>
      </Reveal>

      {signedIn ? (
        <Reveal index={7}>
          <SectionLabel theme={theme}>Danger zone</SectionLabel>
          <Group theme={theme}>
            <Row
              theme={theme}
              icon={<Trash2 size={18} color={amColors.danger} />}
              label="Delete account data"
              noChevron
              danger
              dangerColor={amColors.danger}
              onPress={requestDelete}
            />
          </Group>
        </Reveal>
      ) : null}
    </>
  )

  const overlay = <ConfirmSheet theme={theme} request={confirm} onDismiss={() => setConfirm(null)} />
  return { body, overlay }
}
