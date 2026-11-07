import { AudioLines, Heart, Music, Sparkles, Users, Footprints } from "lucide-react-native"
import { StyleSheet, View } from "react-native"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { BABA_AUDIO_KIND } from "@/lib/searchMenu/kinds"

/** The small round mark of a kind: Prabhat Samgiita (music), Kiirtan (group), Bhajan (heart), Spiritual song (sparkles), Dance music (steps), Baba's voice (waves). */
export function KindMark({ theme, kind, size = 44 }: { theme: SongsTheme; kind: string; size?: number }) {
  const Icon =
    kind === "prabhat_samgiita" ? Music
    : kind === "bhajan" ? Heart
    : kind === "spiritual_song" ? Sparkles
    : kind === "dance_song" ? Footprints
    : kind === BABA_AUDIO_KIND ? AudioLines
    : Users
  const baba = kind === BABA_AUDIO_KIND
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[s.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: baba ? theme.oliveBg : theme.peach }]}
    >
      <Icon size={Math.round(size * 0.46)} color={baba ? theme.oliveText : theme.accent} strokeWidth={1.9} />
    </View>
  )
}

const s = StyleSheet.create({ mark: { alignItems: "center", justifyContent: "center" } })
