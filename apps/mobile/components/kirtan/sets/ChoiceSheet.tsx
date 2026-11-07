import { memo, useCallback } from "react"
import { FlatList, Modal, StyleSheet, Text, View } from "react-native"
import { Check, X } from "lucide-react-native"

import { PICKER_INSET } from "@/components/learn-v2/SongPicker"
import { PressBox } from "@/components/learn-v2/PressBox"
import { useAmTheme } from "@/hooks/useAmTheme"
import { amFonts } from "@/constants/tokens/amTypography"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useT } from "@/lib/i18n"

/**
 * A short list in a sheet: the year or the month of an event. Tapping a row picks it and closes. `clearLabel` adds a
 * first row that picks nothing ("Month not known"). Holds no state: the caller keeps the value.
 */

export type Choice = { key: string; label: string }

export function ChoiceSheet({ visible, title, choices, value, clearLabel, onPick, onClose }: { visible: boolean; title: string; choices: readonly Choice[]; value: string | null; clearLabel?: string; onPick: (key: string | null) => void; onClose: () => void }) {
  const t = useT()
  const p = protoFor(useAmTheme())
  const renderItem = useCallback(({ item }: { item: Choice }) => <ChoiceRow p={p} choice={item} chosen={item.key === value} onChoose={onPick} />, [p, value, onPick])
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
      <View style={[styles.root, { backgroundColor: p.sand200 }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.heading, { color: p.ink800 }]} numberOfLines={2}>
            {title}
          </Text>
          <PressBox accessibilityRole="button" accessibilityLabel={t("ugc.add.close")} onPress={onClose} pressedScale={0.9} style={[styles.close, { backgroundColor: p.white, borderColor: p.sand300 }]}>
            <X size={20} color={p.ink800} strokeWidth={2} />
          </PressBox>
        </View>
        <FlatList
          data={choices}
          extraData={value}
          keyExtractor={(choice) => choice.key}
          renderItem={renderItem}
          ListHeaderComponent={
            clearLabel ? (
              <PressBox accessibilityRole="button" accessibilityLabel={clearLabel} accessibilityState={{ selected: value === null }} onPress={() => onPick(null)} pressedScale={0.99} style={[styles.row, { borderBottomColor: p.sand300 }]}>
                <Text style={[styles.rowText, { color: p.ink500 }]}>{clearLabel}</Text>
                {value === null ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
              </PressBox>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          style={styles.list}
        />
      </View>
    </Modal>
  )
}

const ChoiceRow = memo(function ChoiceRow({ p, choice, chosen, onChoose }: { p: AmProto; choice: Choice; chosen: boolean; onChoose: (key: string) => void }) {
  return (
    <PressBox accessibilityRole="button" accessibilityLabel={choice.label} accessibilityState={{ selected: chosen }} onPress={() => onChoose(choice.key)} pressedScale={0.99} style={[styles.row, { borderBottomColor: p.sand300 }]}>
      <Text style={[styles.rowText, { color: p.ink800 }]}>{choice.label}</Text>
      {chosen ? <Check size={22} color={p.orange700} strokeWidth={2.4} /> : null}
    </PressBox>
  )
})

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PICKER_INSET, paddingTop: 8 },
  heading: { flex: 1, minWidth: 0, fontFamily: amFonts.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.5, textTransform: "uppercase" },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },
  row: { minHeight: 56, paddingHorizontal: PICKER_INSET, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
})
