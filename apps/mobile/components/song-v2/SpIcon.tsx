import { Platform } from "react-native"
import Svg, { Circle, Path, Rect } from "react-native-svg"

/** Icons are decoration (the button names the action). The web build rejects the native props, so it gets aria-hidden. */
const HIDDEN = (
  Platform.OS === "web"
    ? { "aria-hidden": true }
    : { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const }
) as object

/**
 * Line icons of the prototype, drawn from the same 24x24 path data (`stroke-width: 1.75`, round caps).
 * `filled` paths (the play triangle) use the `.f` class of the prototype: fill instead of stroke.
 */
const PATHS = {
  back: "M15 5l-7 7 7 7",
  listPlus: "M4 6h11M4 11h11M4 16h6M17 14v6M14 17h6",
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.6-7 10-7 10z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  play: "M8 5l11 7-11 7z",
  chevDown: "M7 10l5 5 5-5",
  chevRight: "M9 5l7 7-7 7",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  plusThin: "M12 5v14M5 12h14",
  searchHandle: "M16 16l4.5 4.5",
  close: "M6 6l12 12M18 6L6 18",
} as const

export type SpIconName = keyof typeof PATHS | "search" | "pause"

export function SpIcon({
  name,
  size = 22,
  color,
  strokeWidth = 1.75,
  filled = false,
}: {
  name: SpIconName
  size?: number
  color: string
  strokeWidth?: number
  /** fill the shape with the colour (heart when saved, play triangle) */
  filled?: boolean
}) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...HIDDEN}>
      {name === "search" ? (
        <>
          <Circle cx={11} cy={11} r={6.5} {...stroke} />
          <Path d={PATHS.searchHandle} {...stroke} />
        </>
      ) : name === "pause" ? (
        <>
          <Rect x={6.5} y={5} width={4} height={14} rx={1.2} fill={color} />
          <Rect x={13.5} y={5} width={4} height={14} rx={1.2} fill={color} />
        </>
      ) : name === "play" ? (
        <Path d={PATHS.play} fill={color} />
      ) : (
        <Path d={PATHS[name]} {...stroke} fill={filled ? color : "none"} />
      )}
    </Svg>
  )
}
