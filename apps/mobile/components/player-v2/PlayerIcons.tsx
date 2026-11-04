import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The prototype's own SVG glyphs (public/mockup/Main.dc.html), 24x24 viewBox,
 * 1.75 stroke with round caps and joins; `.f` shapes are filled, not stroked.
 * One component, so the player draws exactly what the design draws.
 */
export type PlayerIconName =
  | "chevronDown"
  | "chevronSmall"
  | "aa"
  | "versions"
  | "shuffle"
  | "prev"
  | "next"
  | "play"
  | "pause"
  | "repeat"
  | "drive"
  | "playlistAdd"
  | "queue"
  | "heart"
  | "more"
  | "handle"
  | "plus"
  | "check";

type Props = {
  name: PlayerIconName;
  size: number;
  color: string;
  /** heart only: fill the shape */
  filled?: boolean;
  strokeWidth?: number;
};

export function PlayerIcon({ name, size, color, filled, strokeWidth }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth: strokeWidth ?? 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const;
  const solid = { fill: color, stroke: "none" } as const;
  // The wrapper is a positioned View so the glyph paints above a BlurView that sits behind it in the same button.
  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {name === "chevronDown" ? <Path {...stroke} d="M7 10l5 5 5-5" /> : null}
        {name === "chevronSmall" ? (
          <Path {...stroke} strokeWidth={strokeWidth ?? 2.4} d="M6 9l6 6 6-6" />
        ) : null}
        {name === "aa" ? (
          <>
            <Path {...stroke} d="M3 18l5-12 5 12M5 14h6" />
            <Path {...stroke} d="M15 18v-6a3 3 0 016 0v6M15 15h6" />
          </>
        ) : null}
        {name === "versions" ? (
          <Path
            {...stroke}
            strokeWidth={strokeWidth ?? 2.2}
            d="M4 7h11M4 12h11M4 17h7M18 9v8M15 14l3 3 3-3"
          />
        ) : null}
        {name === "shuffle" ? (
          <>
            <Path
              {...stroke}
              d="M3 7h3.5c4.5 0 6 10 11 10H21M3 17h3.5c1.8 0 3.1-1.2 4.2-3M13.3 9.8C14.5 8 15.8 7 17.5 7H21"
            />
            <Path
              {...stroke}
              d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"
            />
          </>
        ) : null}
        {name === "prev" ? (
          <>
            <Rect {...solid} x={6} y={5} width={2} height={14} />
            <Path {...solid} d="M19 5l-10 7 10 7z" />
          </>
        ) : null}
        {name === "next" ? (
          <>
            <Rect {...solid} x={16} y={5} width={2} height={14} />
            <Path {...solid} d="M5 5l9 7-9 7z" />
          </>
        ) : null}
        {name === "play" ? <Path {...solid} d="M7 4.5l13 7.5-13 7.5z" /> : null}
        {name === "pause" ? (
          <>
            <Rect {...solid} x={6.5} y={5} width={4} height={14} />
            <Rect {...solid} x={13.5} y={5} width={4} height={14} />
          </>
        ) : null}
        {name === "repeat" ? (
          <Path
            {...stroke}
            d="M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4"
          />
        ) : null}
        {name === "drive" ? (
          <>
            <Circle {...stroke} cx={12} cy={12} r={9} />
            <Circle {...stroke} cx={12} cy={12} r={2.2} />
            <Path {...stroke} d="M3 12h6.8M14.2 12H21M12 14.2V21" />
          </>
        ) : null}
        {name === "playlistAdd" ? (
          <Path {...stroke} d="M4 6h11M4 11h11M4 16h6M17 14v6M14 17h6" />
        ) : null}
        {name === "queue" ? (
          <>
            <Path {...stroke} d="M4 6h12M4 12h8M4 18h8" />
            <Path {...solid} d="M16 14l5 3.5-5 3.5z" />
          </>
        ) : null}
        {name === "heart" ? (
          <Path
            {...stroke}
            fill={filled ? color : "none"}
            d="M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.6-7 10-7 10z"
          />
        ) : null}
        {name === "more" ? (
          <>
            <Circle {...solid} cx={5} cy={12} r={1.8} />
            <Circle {...solid} cx={12} cy={12} r={1.8} />
            <Circle {...solid} cx={19} cy={12} r={1.8} />
          </>
        ) : null}
        {name === "handle" ? <Path {...stroke} d="M5 9h14M5 15h14" /> : null}
        {name === "plus" ? <Path {...stroke} d="M12 5v14M5 12h14" /> : null}
        {name === "check" ? (
          <Path
            {...stroke}
            strokeWidth={strokeWidth ?? 2.4}
            d="M5 12.5l4.5 4.5L19 7.5"
          />
        ) : null}
      </Svg>
    </View>
  );
}
