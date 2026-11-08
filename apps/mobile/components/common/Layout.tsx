import { Children, type ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { SCREEN_SIDE, SECTION_GAP, SECTION_TOP, type Space } from "@/lib/layout"

/**
 * The two pieces every page is built from, so the air between blocks is never written by hand (lib/layout.ts,
 * docs/layout-rules.md "Space between blocks").
 *
 *  - <BlockStack gap>   puts a fixed gap between its children, whatever they are (buttons, cards, rows).
 *  - <Section>     a heading with air above it and a gap under it, and the content under that. The air above is the
 *                  same on every page (SECTION_TOP), so a heading never sits on the block above it.
 */

/** Children one under the other (or side by side with `row`), `gap` apart. The gap comes from the scale; there is no way to forget it. */
export function BlockStack({ gap = SECTION_GAP, row, side, style, children }: { gap?: Space; row?: boolean; /** side padding, 0 by default */ side?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[{ gap, flexDirection: row ? "row" : "column", paddingHorizontal: side ?? 0 }, style]}>{children}</View>
}

/**
 * A titled block of a page. `top` is the air above the heading (default SECTION_TOP), `gap` the air under it. With no
 * children it still leaves the gap under the heading, so a list that follows (rows of a FlatList) starts the same
 * distance below it as the content of any other section does.
 */
export function Section({ title, top = SECTION_TOP, gap = SECTION_GAP, side = SCREEN_SIDE, size = "shelf", bleed, children }: { title: string; top?: Space; gap?: Space; side?: number; size?: "shelf" | "page"; /** the content runs edge to edge (a row that scrolls sideways) and pads itself */ bleed?: boolean; children?: ReactNode }) {
  const theme = useSongsTheme()
  const hasContent = Children.count(children) > 0
  return (
    <View style={{ paddingTop: top, gap, paddingBottom: hasContent ? 0 : gap }}>
      <Text style={[styles.title, size === "page" ? styles.page : styles.shelf, { color: theme.textHeading, paddingHorizontal: side }]} accessibilityRole="header">
        {title}
      </Text>
      {hasContent ? <View style={{ gap, paddingHorizontal: bleed ? 0 : side }}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: amFonts.display, textTransform: "uppercase" },
  shelf: { fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  page: { fontSize: 28, lineHeight: 28, letterSpacing: -0.5 },
})
