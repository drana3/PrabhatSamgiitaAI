import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"
import { GripVertical, Trash2 } from "lucide-react-native"
import { Pressable } from "react-native"

import { Sheet } from "@/components/player-v2/Sheet"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { queueOrigin } from "@/lib/playerV2/queueOps"

export type QueueRow = { key: string; number: number; title: string }

type Props = {
  visible: boolean
  theme: AmTheme
  sourceTitle: string
  rows: QueueRow[]
  currentNumber: number | null
  savedNumbers: ReadonlySet<number>
  isPlayable: (number: number) => boolean
  onPlay: (number: number) => void
  onRemove: (number: number) => void
  onOrder: (numbers: number[]) => void
  onClearUpcoming: () => void
  onClose: () => void
}

/**
 * Queue sheet (SCR-12 item 8): reorder by dragging the grip, swipe a row to
 * remove it, each row says `from Mine` or `from Catalog`. Songs with no audio
 * are marked and skipped by next/previous.
 */
export function QueueSheet(props: Props) {
  const { theme, rows, currentNumber } = props
  const canClear = useMemo(() => {
    const at = rows.findIndex((r) => r.number === currentNumber)
    return at >= 0 && at < rows.length - 1
  }, [rows, currentNumber])

  const renderItem = ({ item, drag, isActive }: RenderItemParams<QueueRow>) => {
    const current = item.number === currentNumber
    const playable = props.isPlayable(item.number)
    return (
      <ScaleDecorator>
        <ReanimatedSwipeable
          overshootRight={false}
          rightThreshold={72}
          onSwipeableOpen={() => props.onRemove(item.number)}
          renderRightActions={() => (
            <View style={[styles.removeAction, { backgroundColor: amColors.danger }]}>
              <Trash2 size={20} color={amColors.white} />
            </View>
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, PS ${item.number}, from ${queueOrigin(item.number, props.savedNumbers)}${playable ? "" : ", no audio yet"}`}
            onPress={() => props.onPlay(item.number)}
            style={[
              styles.row,
              { backgroundColor: isActive ? theme.raised : theme.card, borderBottomColor: theme.line },
              !playable && styles.dim,
            ]}
          >
            <View style={styles.text}>
              <Text style={[amType.label, { color: current ? theme.brand : theme.eyebrow }]}>
                PS {item.number} · from {queueOrigin(item.number, props.savedNumbers)}
                {playable ? "" : " · no audio yet"}
              </Text>
              <Text
                style={[amType.body, { fontFamily: current ? amFonts.bold : amFonts.medium, color: theme.textHeading }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${item.title}`}
              onPressIn={drag}
              hitSlop={8}
              style={styles.grip}
            >
              <GripVertical size={20} color={theme.textMuted} />
            </Pressable>
          </Pressable>
        </ReanimatedSwipeable>
      </ScaleDecorator>
    )
  }

  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={`Playing from ${props.sourceTitle}`} theme={theme} heightShare={0.78}>
      {canClear ? (
        <Pressable accessibilityRole="button" onPress={props.onClearUpcoming} style={styles.clear}>
          <Text style={[amType.label, { color: theme.brandPress }]}>Clear what comes next</Text>
        </Pressable>
      ) : null}
      {rows.length ? (
        <DraggableFlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          onDragEnd={({ data }) => props.onOrder(data.map((r) => r.number))}
          activationDistance={8}
        />
      ) : (
        <Text style={[amType.body, { color: theme.textBody }]}>The queue is empty.</Text>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
    paddingVertical: amSpace.s2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: amSpace.s1 },
  grip: { width: amTouchTarget, height: amTouchTarget, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.5 },
  removeAction: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: amRadius.sm,
  },
  clear: { minHeight: amTouchTarget, justifyContent: "center", alignSelf: "flex-end" },
})

