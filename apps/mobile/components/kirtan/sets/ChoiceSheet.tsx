import { memo, useCallback } from "react"
import { FlatList, StyleSheet, Text } from "react-native"
import { Check } from "lucide-react-native"

import { SheetModal } from "@/components/common/SheetModal"
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
    <SheetModal visible={visible} title={title} closeLabel={t("ugc.add.close")} onClose={onClose}>
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
    </SheetModal>
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
  list: { flex: 1 },
  row: { minHeight: 56, paddingHorizontal: PICKER_INSET, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
})
