import { StyleSheet, Text, View } from "react-native"

import { Radio } from "@/components/profile-v2/SheetBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ReviewStyleOption } from "@/lib/reviewStyleCopy"

/** `.srsopt`: radio, then the tag, the name in capitals, the description and the interval line. */
export function ReviewStyleRow({
  p,
  option,
  on,
  onPress,
  last,
}: {
  p: AmProto
  option: ReviewStyleOption
  on: boolean
  onPress: () => void
  last?: boolean
}) {
  return (
    <TodayPress
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${option.name}, ${option.tag}`}
      onPress={onPress}
      pressedScale={0.98}
      style={[s.row, { borderBottomWidth: last ? 0 : 1, borderBottomColor: p.sand300, backgroundColor: on ? p.white : "transparent" }]}
    >
      <View style={s.radio}>
        <Radio p={p} on={on} />
      </View>
      <View style={s.main}>
        <Text style={[s.tag, { color: p.orange700 }]}>{option.tag}</Text>
        <Text style={[s.name, { color: p.ink800 }]}>{option.name}</Text>
        <Text style={[s.desc, { color: p.ink800 }]}>{option.desc}</Text>
        <Text style={[s.line, { color: p.ink500 }]}>{option.line}</Text>
      </View>
    </TodayPress>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 16, paddingHorizontal: 20 },
  radio: { marginTop: 2 },
  main: { flex: 1, minWidth: 0, gap: 4 },
  tag: {
    alignSelf: "flex-start",
    fontFamily: amFonts.semi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: "uppercase",
  },
  name: {
    fontFamily: amFonts.display,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.19,
    textTransform: "uppercase",
  },
  desc: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  line: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
})
