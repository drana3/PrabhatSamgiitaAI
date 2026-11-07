import { StyleSheet, View } from "react-native"
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from "react-native-svg"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { ShareTargetId } from "@/lib/playerV2/playerShare"

/**
 * Round share-target icons. WhatsApp, Telegram, Instagram and Facebook are simplified marks drawn here
 * with react-native-svg in the brands' own colours (a brand's colours are exempt from the app palette);
 * they are not pixel copies of the official artwork. Copy link and More are neutral discs in the theme.
 */
const WHATSAPP = "#25D366"
const TELEGRAM = "#2AABEE"
const FACEBOOK = "#1877F2"
const WHITE = "#FFFFFF"

type Props = { id: ShareTargetId; size?: number; theme: AmTheme }

export function ShareTargetIcon({ id, size = 56, theme }: Props) {
  if (id === "copy" || id === "more") {
    return (
      <View style={[styles.disc, { width: size, height: size, backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1 }]}>
        <PlayerIcon name={id === "copy" ? "link" : "more"} size={Math.round(size * 0.46)} color={theme.textHeading} />
      </View>
    )
  }
  const glyph = Math.round(size * 0.5)
  return (
    <View style={[styles.disc, { width: size, height: size }]} aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 56 56" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ig" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#FEDA75" />
            <Stop offset="0.28" stopColor="#FA7E1E" />
            <Stop offset="0.52" stopColor="#D62976" />
            <Stop offset="0.78" stopColor="#962FBF" />
            <Stop offset="1" stopColor="#4F5BD5" />
          </SvgGradient>
        </Defs>
        <Circle cx={28} cy={28} r={28} fill={fillFor(id)} />
      </Svg>
      <View style={styles.glyphLayer} pointerEvents="none">
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Glyph id={id} />
        </Svg>
      </View>
    </View>
  )
}

function fillFor(id: ShareTargetId): string {
  if (id === "whatsapp") return WHATSAPP
  if (id === "telegram") return TELEGRAM
  if (id === "facebook") return FACEBOOK
  return "url(#ig)"
}

function Glyph({ id }: { id: ShareTargetId }) {
  switch (id) {
    case "whatsapp":
      return (
        <>
          <Path fill={WHITE} d="M12 2.6a9.3 9.3 0 0 0-7.9 14.2L2.8 21.4l4.7-1.2A9.3 9.3 0 1 0 12 2.6z" />
          <Path
            fill={WHATSAPP}
            d="M9.1 6.9c-.3 0-.7.2-.9.6-.5.7-.6 1.7.2 3 1.1 1.9 2.6 3.3 4.4 4 1.3.5 2.2.3 2.7-.4.2-.3.3-.6.2-.9l-1.7-.9c-.2-.1-.5 0-.6.2l-.6.7c-1.1-.4-2-1.4-2.6-2.5l.6-.7c.2-.2.2-.4.1-.7l-.8-1.7c-.1-.2-.2-.2-.5-.2z"
          />
        </>
      )
    case "telegram":
      return (
        <Path
          fill={WHITE}
          fillRule="evenodd"
          d="M20.7 4.3 3.6 10.9c-.7.3-.7 1.2 0 1.4l4.3 1.4 1.7 5.3c.2.6.9.7 1.3.3l2.4-2.3 4.4 3.3c.5.4 1.3.1 1.4-.6L22.2 5.2c.1-.8-.7-1.3-1.5-.9zM8.7 13.2l9.6-5.9c.2-.1.3.1.2.2l-7.4 6.7-.3 3z"
        />
      )
    case "facebook":
      return <Path fill={WHITE} d="M13.6 21.5v-8.2h2.8l.5-3.3h-3.3V7.9c0-.9.4-1.7 1.8-1.7h1.6V3.4s-1.4-.3-2.8-.3c-2.8 0-4.5 1.6-4.5 4.5V10H6.9v3.3h2.8v8.2h3.9z" />
    case "instagram":
      // the Direct mark: a paper plane
      return (
        <Path
          fill="none"
          stroke={WHITE}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          d="M21 3.5 10.3 14M21 3.5l-6.6 17-4.1-6.5L3.8 9.9 21 3.5z"
        />
      )
    default:
      // instagramStories: the camera mark
      return (
        <>
          <Rect x={3.6} y={3.6} width={16.8} height={16.8} rx={5} fill="none" stroke={WHITE} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={3.9} fill="none" stroke={WHITE} strokeWidth={1.8} />
          <Circle cx={17} cy={7} r={1.15} fill={WHITE} />
        </>
      )
  }
}

const styles = StyleSheet.create({
  glyphLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  disc: { borderRadius: 9999, overflow: "hidden", alignItems: "center", justifyContent: "center" },
})
