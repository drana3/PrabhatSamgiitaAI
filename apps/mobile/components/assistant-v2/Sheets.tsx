import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Check, Plus } from "lucide-react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { groupThreadsByDay, questionCountLabel } from "@/lib/assistantHistory"
import { ASSISTANT_LANGUAGES, type AssistantLanguage } from "@/lib/assistantLanguage"
import type { ChatThread } from "@/stores/chatStore"
import { useT } from "@/lib/i18n"

type ThemeProps = { theme: AmTheme }

/** Answer language: one row per language, the chosen one carries a check. */
export function LanguageSheet({
  theme,
  visible,
  value,
  onSelect,
  onClose,
}: ThemeProps & {
  visible: boolean
  value: AssistantLanguage
  onSelect: (language: AssistantLanguage) => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <SpringSheet visible={visible} onClose={onClose} title={t("assistant.sheet.language")} theme={theme}>
      <View style={styles.list}>
        {ASSISTANT_LANGUAGES.map((item) => {
          const selected = item.id === value
          return (
            <PressScale
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              onPress={() => onSelect(item.id)}
              pressedScale={0.985}
              style={[
                styles.row,
                {
                  backgroundColor: theme.card,
                  borderColor: selected ? theme.brand : theme.line,
                },
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{item.label}</Text>
                {item.note ? <Text style={[styles.rowNote, { color: theme.textBody }]}>{item.note}</Text> : null}
              </View>
              {selected ? <Check size={22} color={theme.brand} /> : null}
            </PressScale>
          )
        })}
        <Text style={[styles.footnote, { color: theme.textBody }]}>
          {t("assistant.sheet.footnote")}
        </Text>
      </View>
    </SpringSheet>
  )
}

/**
 * Past chats for this song (or for all songs), grouped by day, with a new chat
 * button and a two-tap clear. Spec SCR-14 also lists "clear chat history" in the
 * Profile sheet; ClearHistoryButton is exported for that row.
 */
export function ChatsSheet({
  theme,
  visible,
  threads,
  activeThreadId,
  scopeLabel,
  onOpen,
  onNew,
  onClear,
  onClose,
  now,
}: ThemeProps & {
  visible: boolean
  threads: ChatThread[]
  activeThreadId: string | null
  scopeLabel: string
  onOpen: (threadId: string) => void
  onNew: () => void
  onClear: () => void
  onClose: () => void
  now: number
}) {
  const t = useT()
  const groups = groupThreadsByDay(threads, now)
  return (
    <SpringSheet visible={visible} onClose={onClose} title={t("assistant.pastChats")} theme={theme}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>{scopeLabel}</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t("assistant.chats.start")}
          onPress={() => {
            onNew()
            onClose()
          }}
          style={[styles.newChat, { backgroundColor: theme.brand }]}
        >
          <Plus size={20} color={theme.onBrand} />
          <Text style={[styles.newChatText, { color: theme.onBrand }]}>{t("assistant.newChat")}</Text>
        </PressScale>

        {groups.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textBody }]}>{t("assistant.chats.empty")}</Text>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={[amType.label, { color: theme.textBody }]}>{group.label}</Text>
              {group.threads.map((thread) => (
                <PressScale
                  key={thread.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${thread.title}, ${questionCountLabel(thread)}`}
                  onPress={() => {
                    onOpen(thread.id)
                    onClose()
                  }}
                  pressedScale={0.985}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.card,
                      borderColor: thread.id === activeThreadId ? theme.brand : theme.line,
                    },
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.textHeading }]}>
                      {thread.title}
                    </Text>
                    <Text style={[styles.rowNote, { color: theme.textBody }]}>{questionCountLabel(thread)}</Text>
                  </View>
                </PressScale>
              ))}
            </View>
          ))
        )}

        {groups.length ? <ClearHistoryButton theme={theme} onConfirm={onClear} /> : null}
      </ScrollView>
    </SpringSheet>
  )
}

/** Destructive, so it takes two taps: the first arms it, the second clears. */
export function ClearHistoryButton({ theme, onConfirm }: ThemeProps & { onConfirm: () => void }) {
  const t = useT()
  const [armed, setArmed] = useState(false)
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={armed ? t("assistant.chats.clearConfirm") : t("assistant.chats.clear")}
      onPress={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      style={[styles.clear, { borderColor: armed ? theme.brandPress : theme.line }]}
    >
      <Text style={[styles.clearText, { color: armed ? theme.brandPress : theme.textBody }]}>
        {armed ? t("assistant.chats.clearArmed") : t("assistant.chats.clear")}
      </Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  list: { gap: amGap.grid, paddingBottom: 16 },
  group: { gap: amGap.grid, marginTop: 8 },
  row: {
    minHeight: 56,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  rowNote: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  footnote: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, marginTop: 8 },
  newChat: {
    height: 48,
    borderRadius: amRadius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newChatText: { fontFamily: amFonts.semi, fontSize: 16 },
  empty: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23, paddingVertical: 16 },
  clear: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  clearText: { fontFamily: amFonts.medium, fontSize: 16 },
})
