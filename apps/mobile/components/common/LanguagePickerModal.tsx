import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { X } from "lucide-react-native"

import { IconButton } from "@/components/common/IconButton"
import { colors } from "@/constants/colors"
import { localeOptions, type LocaleOption } from "@/constants/languages"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

const GROUPS: LocaleOption["group"][] = ["Indian languages", "World languages"]

type Props = {
  visible: boolean
  selectedCode: string
  onClose: () => void
  onSelect: (code: string) => void
}

export function LanguagePickerModal({ visible, selectedCode, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Choose language</Text>
              <Text style={styles.subtitle}>Meaning language for this song</Text>
            </View>
            <IconButton soft accessibilityLabel="Close languages" onPress={onClose}>
              <X size={18} color={colors.textPrimary} />
            </IconButton>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            {GROUPS.map((group) => {
              const options = localeOptions.filter((option) => option.group === group)
              if (!options.length) return null
              return (
                <View key={group} style={styles.group}>
                  <Text style={styles.groupLabel}>{group}</Text>
                  <View style={styles.chipWrap}>
                    {options.map((option) => {
                      const selected = option.code === selectedCode
                      return (
                        <Pressable
                          key={option.code}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${option.label} (${option.nativeLabel})`}
                          onPress={() => {
                            onSelect(option.code)
                            onClose()
                          }}
                          style={[styles.chip, selected && styles.chipActive]}
                        >
                          <Text style={[styles.chipNative, selected && styles.chipTextActive]}>
                            {option.nativeLabel}
                          </Text>
                          <Text style={[styles.chipLabel, selected && styles.chipTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,14,10,0.35)",
  },
  sheet: {
    maxHeight: "78%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  list: { paddingBottom: spacing.xxl, gap: spacing.lg },
  group: { gap: spacing.sm },
  groupLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minWidth: "46%",
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipNative: { ...typography.label, color: colors.textPrimary },
  chipLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chipTextActive: { color: colors.primaryDark },
})
