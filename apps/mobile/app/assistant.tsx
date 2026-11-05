import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AskComposer } from "@/components/assistant-v2/AskComposer"
import { AskHeading, AskTopBar, GroundingStrip } from "@/components/assistant-v2/AskHeader"
import {
  AnswerCard,
  NoticeCard,
  QuestionPill,
  SuggestionRow,
  TypingDots,
} from "@/components/assistant-v2/Messages"
import { ChatsSheet, LanguageSheet } from "@/components/assistant-v2/Sheets"
import { Reveal } from "@/components/today/motion"
import { amGap } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useAssistantChat } from "@/hooks/useAssistantChat"
import { languagePillLabel } from "@/lib/assistantLanguage"
import { quotaHelp } from "@/lib/assistantQuota"
import { openSongScreen } from "@/lib/openSong"
import { isNearBottom } from "@/lib/assistantSheetPhysics"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

function songParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  const number = Number(raw)
  return Number.isInteger(number) && number >= 1 && number <= 5018 ? number : null
}

/**
 * Ask (spec 2.2, SCR-03 replacement): the assistant as a sheet opened from the
 * Player, the song page or search, never a tab.
 *   /assistant?song=12        ask about PS 12
 *   /assistant?q=...          hand a question over from search (sent once)
 * Redesign route; the existing AI tab is untouched.
 */
export default function AssistantScreen() {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ song?: string; q?: string }>()
  const chat = useAssistantChat({ songParam: songParam(params.song) })

  const [draft, setDraft] = useState("")
  const [blocked, setBlocked] = useState<string | null>(null)
  const [chatsOpen, setChatsOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)

  const voice = useVoiceSearch({
    onPartial: (text) => setDraft(text),
    onFinal: (text) => setDraft(text),
  })

  const scroll = useRef<ScrollView>(null)
  const following = useRef(true)
  const metrics = useRef({ viewport: 0, content: 0 })

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
    metrics.current = { viewport: layoutMeasurement.height, content: contentSize.height }
    following.current = isNearBottom({
      offsetY: contentOffset.y,
      viewportHeight: layoutMeasurement.height,
      contentHeight: contentSize.height,
    })
  }

  // Follow the answer as it streams, unless the reader scrolled up to re-read.
  const onContentSizeChange = (_width: number, height: number) => {
    metrics.current.content = height
    if (following.current && chat.messages.length > 0) scroll.current?.scrollToEnd({ animated: true })
  }

  /** Ask a question. A question the guard rejects goes back into the field to be fixed. */
  const ask = useCallback(
    async (text: string) => {
      const value = text.trim()
      if (!value) return
      setBlocked(null)
      following.current = true
      const result = await chat.send(value)
      if (result.status === "blocked") {
        setBlocked(result.guidance)
        setDraft(value)
      }
    },
    [chat],
  )

  const onSend = () => {
    const value = draft
    if (!value.trim()) return
    setDraft("")
    void ask(value)
  }

  // A question handed over from search lands in the field; the reader taps
  // send. A deep link must never spend a question on its own.
  const handedOver = useRef(false)
  useEffect(() => {
    const q = Array.isArray(params.q) ? params.q[0] : params.q
    if (!q || handedOver.current) return
    handedOver.current = true
    setDraft(q)
  }, [params.q])

  const close = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/today"))
  }
  const openSong = (number: number) => openSongScreen(router, number)

  const initialCount = useRef(chat.messages.length)
  const hasMessages = chat.messages.length > 0
  const grounded = Boolean(chat.groundedNumber)
  const exhausted = chat.quota.left <= 0

  const hint = useMemo(() => {
    if (voice.listening) return t("assistant.hint.listening")
    if (voice.error) return voice.error
    if (blocked) return blocked
    if (chat.sending) return t("assistant.hint.finding")
    return undefined
  }, [voice.listening, voice.error, blocked, chat.sending, t])

  const scopeLabel = grounded
    ? t("assistant.scope.song", { number: String(chat.groundedNumber) })
    : t("assistant.scope.all")

  return (
    <View style={[styles.root, { backgroundColor: theme.page, paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          presentation: Platform.OS === "ios" ? "modal" : "card",
          animation: Platform.OS === "ios" ? "slide_from_bottom" : "fade",
          gestureEnabled: true,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.pad}>
          <AskTopBar
            theme={theme}
            onClose={close}
            onNewChat={chat.newChat}
            onChats={() => setChatsOpen(true)}
            canStartNew={hasMessages}
          />
        </View>

        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
        >
          <Reveal index={0}>
            <AskHeading theme={theme} grounded={grounded} />
          </Reveal>
          <Reveal index={1}>
            <GroundingStrip
              theme={theme}
              songNumber={chat.groundedNumber}
              title={chat.songTitle}
              language={languagePillLabel(chat.language)}
              onOpenSong={() => chat.groundedNumber && openSong(chat.groundedNumber)}
              onDetach={chat.detachSong}
              onLanguage={() => setLanguageOpen(true)}
              quotaLabel={chat.quota.label}
            />
          </Reveal>

          {!hasMessages ? (
            <View style={styles.stack}>
              <Reveal index={2}>
                <Text style={[styles.lead, { color: theme.textBody }]}>
                  {grounded
                    ? t("assistant.lead.song", { number: String(chat.groundedNumber) })
                    : t("assistant.lead.all")}
                </Text>
              </Reveal>
              {chat.suggestions.map((item, i) => (
                <Reveal key={item} index={3 + i}>
                  <SuggestionRow theme={theme} label={item} onPress={() => void ask(item)} />
                </Reveal>
              ))}
            </View>
          ) : (
            <View style={styles.stack}>
              {chat.messages.map((message, i) => {
                const index = i < initialCount.current ? Math.min(i, 4) : 0
                if (message.role === "user") {
                  return <QuestionPill key={message.id} theme={theme} text={message.text} index={index} />
                }
                if (message.pending) return <TypingDots key={message.id} theme={theme} />
                if (message.kind === "answer") {
                  return (
                    <AnswerCard
                      key={message.id}
                      theme={theme}
                      index={index}
                      text={message.text}
                      sources={message.sources}
                      noSourceCaution={message.noSourceCaution}
                      groundedTitle={chat.songTitle}
                      onOpenSong={openSong}
                    />
                  )
                }
                const isQuota = message.kind === "quota"
                return (
                  <NoticeCard
                    key={message.id}
                    theme={theme}
                    index={index}
                    text={
                      message.kind === "empty"
                        ? t("assistant.noAnswer")
                        : message.kind === "quota"
                          ? t("assistant.quota.reached")
                          : message.text
                    }
                    help={isQuota ? quotaHelp(chat.quota.isMember) : undefined}
                    actionLabel={isQuota && !chat.quota.isMember ? t("account.signIn.title") : undefined}
                    onAction={isQuota && !chat.quota.isMember ? () => router.push(href("/signin")) : undefined}
                  />
                )
              })}
              {!chat.sending && chat.suggestions.length > 0 && !exhausted ? (
                <View style={styles.next}>
                  {chat.suggestions.slice(0, 3).map((item, i) => (
                    <Reveal key={item} index={i}>
                      <SuggestionRow theme={theme} label={item} onPress={() => void ask(item)} />
                    </Reveal>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.pad, { paddingBottom: Math.max(insets.bottom, amGap.grid) }]}>
          <AskComposer
            theme={theme}
            value={draft}
            onChangeText={(text) => {
              setDraft(text)
              if (blocked) setBlocked(null)
            }}
            onSend={onSend}
            onVoicePress={() => void voice.toggle()}
            voiceListening={voice.listening}
            sending={chat.sending}
            hint={hint}
            placeholder={
              grounded
                ? t("assistant.placeholder.song", { number: String(chat.groundedNumber) })
                : t("assistant.placeholder.all")
            }
          />
        </View>
      </KeyboardAvoidingView>

      <LanguageSheet
        theme={theme}
        visible={languageOpen}
        value={chat.language}
        onSelect={(language) => {
          chat.setLanguage(language)
          setLanguageOpen(false)
        }}
        onClose={() => setLanguageOpen(false)}
      />
      <ChatsSheet
        theme={theme}
        visible={chatsOpen}
        threads={chat.past}
        activeThreadId={chat.activeThreadId}
        scopeLabel={scopeLabel}
        now={Date.now()}
        onOpen={chat.openThread}
        onNew={chat.newChat}
        onClear={chat.clearHistory}
        onClose={() => setChatsOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pad: { paddingHorizontal: amGap.gutter },
  content: { paddingHorizontal: amGap.gutter, paddingBottom: amGap.block },
  stack: { gap: amGap.grid },
  next: { gap: amGap.grid, marginTop: amGap.block },
  lead: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23, marginBottom: 6 },
})
