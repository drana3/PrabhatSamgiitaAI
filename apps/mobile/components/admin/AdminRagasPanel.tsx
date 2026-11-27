import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import type { RagaCollectionConflict, RagaCollectionItem } from "@prabhat/core"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"

function parseSongNumbers(raw: string): number[] {
  const tokens = raw.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)
  const numbers: number[] = []
  for (const token of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        for (let value = start; value <= end; value += 1) numbers.push(value)
      }
      continue
    }
    const value = Number(token)
    if (Number.isFinite(value)) numbers.push(value)
  }
  return [...new Set(numbers)].sort((a, b) => a - b)
}

export function AdminRagasPanel() {
  const [items, setItems] = useState<RagaCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [numbersText, setNumbersText] = useState("")
  const [assignMetadata, setAssignMetadata] = useState(true)
  const [busy, setBusy] = useState(false)
  const [conflicts, setConflicts] = useState<RagaCollectionConflict[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.fetchAdminRagaCollections()
    setItems(result.items)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(overwrite = false) {
    const song_numbers = parseSongNumbers(numbersText)
    if (!label.trim()) {
      Alert.alert("Raga name required", "Enter a raga or form name.")
      return
    }
    if (!song_numbers.length) {
      Alert.alert("Song numbers required", "Add at least one song number between 1 and 5018.")
      return
    }
    setBusy(true)
    const result = await api.upsertAdminRagaCollection({
      label: label.trim(),
      description: description.trim() || null,
      song_numbers,
      assign_metadata: assignMetadata,
      overwrite,
    })
    setBusy(false)
    if (!result.ok) {
      if (result.conflicts?.length) {
        setConflicts(result.conflicts)
        Alert.alert(
          "Overwrite required",
          result.detail ?? "Some songs already have a different raga. Save again to overwrite.",
        )
        return
      }
      Alert.alert("Could not save", result.detail ?? "Try again.")
      return
    }
    setConflicts([])
    await load()
    Alert.alert("Saved", `${result.collection.label} is live on web and mobile browse.`)
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Raga collections</Text>
      <Text style={styles.lead}>
        Curate Explore lists and optional per-song Raga metadata. Numbers must be 1–5018.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Raga name</Text>
        <TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="Yaman" />
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Text style={styles.label}>Song numbers</Text>
        <TextInput
          value={numbersText}
          onChangeText={setNumbersText}
          style={[styles.input, styles.multiline, styles.mono]}
          multiline
          placeholder="1565 or 138-150"
        />
        <Pressable onPress={() => setAssignMetadata((value) => !value)} style={styles.checkRow}>
          <View style={[styles.checkbox, assignMetadata && styles.checkboxOn]} />
          <Text style={styles.checkLabel}>Set per-song Raga metadata</Text>
        </Pressable>
        {conflicts.length ? (
          <View style={styles.conflictBox}>
            {conflicts.map((row) => (
              <Text key={row.song_number} style={styles.conflictLine}>
                PS {row.song_number}: {row.existing_raga} → {row.new_raga}
              </Text>
            ))}
            <PrimaryButton label="Overwrite metadata" onPress={() => void save(true)} disabled={busy} />
          </View>
        ) : null}
        <PrimaryButton label={busy ? "Saving…" : "Save collection"} onPress={() => void save(false)} disabled={busy} />
      </View>

      <Text style={styles.subheading}>Published ({items.length})</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        items.map((row) => (
          <Pressable
            key={row.label}
            style={styles.row}
            onPress={() => {
              setLabel(row.label)
              setDescription(row.description ?? "")
              setNumbersText(row.song_numbers.join(", "))
            }}
          >
            <Text style={styles.rowTitle}>{row.label}</Text>
            <Text style={styles.rowMeta}>{row.count} songs</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  heading: { ...typography.title, color: colors.text },
  lead: { ...typography.body, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...softShadow,
  },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  mono: { fontFamily: "Menlo" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.xs },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { ...typography.body, color: colors.text },
  conflictBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "#FFF8E8",
    gap: spacing.xs,
  },
  conflictLine: { ...typography.caption, color: colors.text },
  subheading: { ...typography.subtitle, color: colors.text, marginTop: spacing.sm },
  row: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
    ...softShadow,
  },
  rowTitle: { ...typography.body, fontWeight: "600", color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
})