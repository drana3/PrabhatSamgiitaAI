import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist"
import { GripVertical } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { api } from "@/lib/client"
import { songDetailToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

const MIN_QUEUE_TO_REORDER = 2

type QueueRow = { key: string; number: number }

export function DriveReorderableQueue() {
  const queue = usePlayerStore((s) => s.queue)
  const currentNumber = usePlayerStore((s) => s.currentSong?.number ?? null)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const driveAutoAdvance = usePlayerStore((s) => s.driveAutoAdvance)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const loadSong = usePlayerStore((s) => s.loadSong)

  const data = useMemo(
    () => queue.map((number) => ({ key: `ps-${number}`, number })),
    [queue],
  )

  const titleByNumber = useMemo(() => {
    const hits = catalogSongsByNumbers(queue, queue.length)
    return new Map(hits.map((hit) => [hit.number, hit.firstLine || hit.title]))
  }, [queue])

  const showReorder =
    playbackMode === "playlist" && data.length >= MIN_QUEUE_TO_REORDER
  if (!showReorder) return null

  const onDragEnd = ({ data: next }: { data: QueueRow[] }) => {
    setQueue(next.map((row) => row.number))
  }

  const playFromRow = (number: number) => {
    if (number === currentNumber) return
    void (async () => {
      const detail = await api.fetchSong(number)
      if (!detail) return
      const order = usePlayerStore.getState().queue
      loadSong(songDetailToMockSong(detail), order, "playlist")
    })()
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<QueueRow>) => {
    const isCurrent = item.number === currentNumber
    const title = titleByNumber.get(item.number) ?? `Prabhat Samgiita ${item.number}`
    return (
      <ScaleDecorator>
        <View style={[styles.row, isActive && styles.rowActive, isCurrent && styles.rowCurrent]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Drag to reorder"
            onPressIn={drag}
            hitSlop={10}
            style={styles.dragHandle}
          >
            <GripVertical size={24} color={colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${isCurrent ? "Now playing" : "Play"} PS ${item.number}, ${title}`}
            onPress={() => playFromRow(item.number)}
            style={styles.rowPress}
          >
            <View style={styles.meta}>
              <Text style={[styles.number, isCurrent && styles.numberCurrent]}>PS {item.number}</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            {isCurrent ? <Text style={styles.now}>Now</Text> : null}
          </Pressable>
        </View>
      </ScaleDecorator>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Up next</Text>
      <Text style={styles.hint}>
        {driveAutoAdvance
          ? "Drag the handle to reorder · tap a row to play"
          : "Drag the handle to reorder your playlist"}
      </Text>
      <NestableDraggableFlatList
        data={data}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onDragEnd={onDragEnd}
        containerStyle={styles.list}
        activationDistance={4}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  heading: { ...typography.label, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  dragHandle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "center",
  },
  rowPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  rowActive: {
    backgroundColor: colors.primaryLight,
    opacity: 0.98,
  },
  rowCurrent: {
    backgroundColor: colors.surfaceSoft,
  },
  meta: { flex: 1, minWidth: 0 },
  number: { ...typography.caption, color: colors.textSecondary },
  numberCurrent: { color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  title: { ...typography.bodySmall, color: colors.textPrimary },
  now: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
})
