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
  | "check"
  | "share"
  | "link"
  | "whatsapp"
  | "instagram"
  | "messages"
  | "music"
  | "library"
  | "timer"
  | "flag"
  | "queueAdd";

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
        {name === "share" ? (
          <Path {...stroke} d="M12 15V4M8 8l4-4 4 4M6 11H5.5A1.5 1.5 0 004 12.5v6A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-6a1.5 1.5 0 00-1.5-1.5H18" />
        ) : null}
        {name === "link" ? (
          <Path {...stroke} d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
        ) : null}
        {name === "whatsapp" ? (
          <>
            <Path {...stroke} d="M4 20l1.2-4.1A8.2 8.2 0 1112 20.2a8.1 8.1 0 01-3.9-1L4 20z" />
            <Path {...stroke} strokeWidth={strokeWidth ?? 1.5} d="M9.3 8.8c-.3.7-.1 1.7.9 3 1 1.3 2.3 2.3 3.4 2.6.9.2 1.5-.2 1.7-.9l-1.6-1-.8.7c-.8-.3-1.6-1-2.1-1.9l.7-.8-.9-1.6c-.5-.1-1 .1-1.3-.1z" />
          </>
        ) : null}
        {name === "instagram" ? (
          <>
            <Rect {...stroke} x={4} y={4} width={16} height={16} rx={5} />
            <Circle {...stroke} cx={12} cy={12} r={3.7} />
            <Circle {...solid} cx={16.9} cy={7.1} r={1.1} />
          </>
        ) : null}
        {name === "messages" ? (
          <Path {...stroke} d="M6 5h12a2.5 2.5 0 012.5 2.5v6A2.5 2.5 0 0118 16h-5.5L8 19.5V16H6a2.5 2.5 0 01-2.5-2.5v-6A2.5 2.5 0 016 5z" />
        ) : null}
        {name === "music" ? (
          <>
            <Path {...stroke} d="M9 17.5V6l10-2v11" />
            <Circle {...stroke} cx={6.8} cy={17.5} r={2.2} />
            <Circle {...stroke} cx={16.8} cy={15} r={2.2} />
          </>
        ) : null}
        {name === "library" ? <Path {...stroke} d="M5 4v16M10 4v16M14.5 5.5l4.6 14.2" /> : null}
        {name === "timer" ? (
          <>
            <Circle {...stroke} cx={12} cy={13.5} r={7.5} />
            <Path {...stroke} d="M12 13.5V9.5M10 2.5h4M18.5 6l1.2-1.2" />
          </>
        ) : null}
        {name === "flag" ? <Path {...stroke} d="M5.5 21V4M5.5 4.5h11.8l-2.3 3.8 2.3 3.7H5.5" /> : null}
        {name === "queueAdd" ? (
          <>
            <Path {...stroke} d="M4 6h12M4 12h7M4 18h6" />
            <Circle {...stroke} cx={17.5} cy={16.5} r={4} />
            <Path {...stroke} d="M17.5 14.6v3.8M15.6 16.5h3.8" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
