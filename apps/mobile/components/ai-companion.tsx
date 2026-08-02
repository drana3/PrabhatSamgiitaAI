import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import { api, colors, radii, spacing, typography } from "@/lib/client"
import { cardElevation, hairline } from "@/lib/theme"
import {
  FOLLOW_UP_PROMPTS,
  formatAssistantMessage,
  hasUserMessages,
  STARTER_PROMPTS,
  validatePrompt,
  type ChatMessage,
} from "@/lib/chat"

function PromptStrip({
  prompts,
  onSelect,
}: {
  prompts: string[]
  onSelect: (prompt: string) => void
}) {
  if (!prompts.length) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.promptRow}
      keyboardShouldPersistTaps="handled"
    >
      {prompts.map((prompt) => (
        <Pressable key={prompt} onPress={() => onSelect(prompt)} style={styles.promptChip}>
          <Text style={styles.promptChipText}>{prompt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function MessageBubble({ message, loading }: { message: ChatMessage; loading: boolean }) {
  const isUser = message.role === "user"
  const text = isUser ? message.text : formatAssistantMessage(message.text)

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {loading && !text ? (
          <ActivityIndicator color={colors.gold500} size="small" />
        ) : (
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAssistant]}>
            {text}
          </Text>
        )}
      </View>
    </View>
  )
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="sparkles-outline" size={22} color={colors.gold500} />
      </View>
      <Text style={styles.emptyTitle}>Ask about this song</Text>
      <Text style={styles.emptyCopy}>Meaning, imagery, pronunciation, or a summary in Hindi.</Text>
    </View>
  )
}

export function AiCompanion({ songNumber }: { songNumber: number }) {
  const [query, setQuery] = useState("")
  const [inputError, setInputError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const listRef = useRef<FlatList<ChatMessage>>(null)

  useEffect(() => {
    setMessages([])
    setQuery("")
    setInputError(null)
    setLoading(false)
  }, [songNumber])

  useEffect(() => {
    if (messages.length) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [loading, messages])

  async function ask(suggestedPrompt?: string) {
    const nextPrompt = (suggestedPrompt ?? query.trim()).trim()
    const error = validatePrompt(nextPrompt)
    if (error) {
      setInputError(error)
      return
    }

    setInputError(null)
    setLoading(true)
    setQuery("")
    setMessages((current) => [
      ...current,
      { role: "user", text: nextPrompt },
      { role: "assistant", text: "" },
    ])

    const history = messages
      .filter((message) => message.text.trim())
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.text }))

    let streamed = ""
    try {
      await api.streamExplanation(songNumber, (chunk) => {
        streamed = streamed ? `${streamed}\n${chunk}` : chunk
        setMessages((current) => {
          const next = [...current]
          next[next.length - 1] = { role: "assistant", text: streamed }
          return next
        })
      }, nextPrompt, history)
    } catch {
      setMessages((current) => {
        const next = [...current]
        next[next.length - 1] = {
          role: "assistant",
          text: "Could not complete that response. Try again.",
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const userTurns = hasUserMessages(messages)
  const starterPrompts = userTurns ? [] : STARTER_PROMPTS
  const followUps = userTurns && !loading ? FOLLOW_UP_PROMPTS : []

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
    >
      <View style={styles.chatBody}>
        {!userTurns && !loading ? <EmptyState /> : null}

        {starterPrompts.length ? (
          <PromptStrip prompts={starterPrompts} onSelect={(prompt) => void ask(prompt)} />
        ) : null}

        {messages.length ? (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, index) => `${item.role}-${index}-${item.text.slice(0, 24)}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <MessageBubble
                message={item}
                loading={loading && index === messages.length - 1 && item.role === "assistant"}
              />
            )}
          />
        ) : null}

        {followUps.length ? (
          <PromptStrip prompts={followUps} onSelect={(prompt) => void ask(prompt)} />
        ) : null}
      </View>

      <View style={styles.inputArea}>
        <View style={[styles.inputRow, inputError ? styles.inputRowError : null]}>
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value)
              if (inputError) setInputError(null)
            }}
            placeholder="Your question…"
            placeholderTextColor={colors.stone500}
            multiline
            maxLength={800}
            style={styles.input}
            editable={!loading}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => {
              if (!loading) void ask()
            }}
          />
          <Pressable
            onPress={() => void ask()}
            disabled={loading || !query.trim()}
            style={[styles.sendButton, loading || !query.trim() ? styles.sendButtonDisabled : null]}
          >
            <Ionicons name="arrow-up" size={18} color={colors.white} />
          </Pressable>
        </View>
        {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
        {userTurns ? (
          <Pressable
            onPress={() => {
              setMessages([])
              setQuery("")
              setInputError(null)
            }}
            style={styles.resetLink}
          >
            <Text style={styles.resetText}>Start fresh</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
  },
  chatBody: {
    flex: 1,
    gap: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ivory100,
    borderWidth: 1,
    borderColor: "rgba(202, 138, 39, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.navy950,
    fontSize: typography.body,
    fontWeight: "700",
  },
  emptyCopy: {
    color: colors.stone600,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: "center",
  },
  promptRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  promptChip: {
    maxWidth: 260,
    borderRadius: radii.pill,
    backgroundColor: colors.ivory100,
    borderWidth: 1,
    borderColor: "rgba(202, 138, 39, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptChipText: {
    color: colors.navy950,
    fontSize: typography.caption,
    fontWeight: "600",
    lineHeight: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.navy950,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.ivory50,
    borderWidth: 1,
    borderColor: hairline,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  messageTextUser: {
    color: colors.white,
  },
  messageTextAssistant: {
    color: colors.stone600,
  },
  inputArea: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: hairline,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: hairline,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    ...cardElevation(1),
  },
  inputRowError: {
    borderColor: "#dc2626",
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 88,
    color: colors.navy950,
    fontSize: typography.body,
    paddingVertical: 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold500,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: typography.caption,
    lineHeight: 18,
  },
  resetLink: {
    alignSelf: "flex-start",
  },
  resetText: {
    color: colors.stone600,
    fontSize: typography.caption,
    fontWeight: "600",
  },
})
