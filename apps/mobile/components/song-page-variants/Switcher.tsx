import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SpPress } from "@/components/song-v2/SpUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { routeString } from "@/lib/songMap"
import { parseVariant, resolveVariant, VARIANT_LABEL, type SongPageVariant } from "@/lib/songPageVariants/variant"
import { useSongPageVariantStore } from "@/stores/songPageVariantStore"

const ORDER: SongPageVariant[] = ["a", "b", "c", "current"]

/**
 * Which variant shows. Real builds always show B. In the preview (MOCKUP_DATA) the query `?variant=a|b|c|current`
 * wins on arrival and is saved, then the switcher's pick is saved (store key `song-page-variant`).
 */
export function useResolvedVariant(): { variant: SongPageVariant; pick: (next: SongPageVariant) => void } {
  const params = useLocalSearchParams<{ variant?: string | string[] }>()
  const queryVariant = parseVariant(routeString(params.variant))
  const stored = useSongPageVariantStore((s) => s.variant)
  const setStored = useSongPageVariantStore((s) => s.setVariant)
  const [override, setOverride] = useState<SongPageVariant | null>(queryVariant)
  useEffect(() => {
    if (!MOCKUP_DATA) return
    setOverride(queryVariant)
    if (queryVariant) setStored(queryVariant)
  }, [queryVariant, setStored])
  const pick = useCallback(
    (next: SongPageVariant) => {
      setOverride(null)
      setStored(next)
    },
    [setStored],
  )
  return { variant: resolveVariant({ mockup: MOCKUP_DATA, query: override ?? undefined, stored }), pick }
}

/** A · B · C · Current, a small dark pill in the middle of the top row. Only drawn when MOCKUP_DATA is on. */
export function VariantSwitcher({ variant, onPick }: { variant: SongPageVariant; onPick: (next: SongPageVariant) => void }) {
  const insets = useSafeAreaInsets()
  if (!MOCKUP_DATA) return null
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: Math.max(insets.top, 12) + 4 }]}>
      <View style={styles.pill} accessibilityRole="tablist" accessibilityLabel="Song page variant">
        {ORDER.map((id) => {
          const on = id === variant
          return (
            <SpPress
              key={id}
              onPress={() => onPick(id)}
              accessibilityRole="tab"
              accessibilityLabel={id === "current" ? "Current page" : `Variant ${id.toUpperCase()}`}
              accessibilityState={{ selected: on }}
              pressedScale={0.94}
              style={[styles.seg, id === "current" && styles.segWide, on && styles.segOn]}
            >
              <Text style={[styles.label, { color: on ? "#14100C" : "rgba(255,255,255,0.88)" }]}>{VARIANT_LABEL[id]}</Text>
            </SpPress>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 60, alignItems: "center", height: 44, justifyContent: "center" },
  pill: { flexDirection: "row", padding: 3, borderRadius: 9999, backgroundColor: "rgba(20,16,12,0.78)", gap: 2 },
  seg: { minWidth: 38, height: 38, borderRadius: 9999, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segWide: { minWidth: 64 },
  segOn: { backgroundColor: "#FFFFFF" },
  label: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
})
