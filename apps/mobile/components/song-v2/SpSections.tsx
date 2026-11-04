import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import Svg, { Path, Text as SvgText } from "react-native-svg"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ScriptId } from "@/lib/songPage/scripts"
import { diagramFor, type ChordCard } from "@/lib/songPage/spChords"
import type { SpWordRow } from "@/lib/songPage/spLines"
import type { SongExplanation } from "@/lib/songPage/songContent"

import { SpIcon } from "./SpIcon"
import { bodyT, note, over } from "./spType"
import { SpCard, SpChip, SpPill, SpPress, SpRound, SpTcHead } from "./SpUi"

/* ---------------- Words ---------------- */

export function SpWords({
  t,
  rows,
  script,
  note: wNote,
  languages,
  activeLanguage,
  onLanguage,
  onMore,
}: {
  t: SpTheme
  rows: SpWordRow[]
  script: ScriptId
  note: string
  languages: Array<{ code: string; label: string }>
  activeLanguage: string | null
  onLanguage: (code: string) => void
  onMore: () => void
}) {
  const rmFont = script === "devanagari" ? amFonts.devanagariBold : script === "bengali" ? amFonts.bengaliBold : amFonts.bold
  return (
    <SpCard t={t}>
      <SpTcHead t={t} label="Word by word" note={wNote} />
      <View style={styles.wlangs}>
        {languages.map((language) => {
          const on = activeLanguage === language.code
          return (
            <SpPress
              key={language.code}
              onPress={() => onLanguage(language.code)}
              accessibilityState={{ selected: on }}
              accessibilityLabel={language.label}
              style={[
                styles.wchip,
                { backgroundColor: on ? t.sage700 : t.white, borderColor: on ? t.sage700 : t.sand300 },
              ]}
            >
              <Text style={[styles.wchipText, { color: on ? "#FFFFFF" : t.ink800 }]}>{language.label}</Text>
            </SpPress>
          )
        })}
        <SpPress
          onPress={onMore}
          accessibilityLabel="More languages and two translations"
          style={[styles.wchip, styles.wchipMore, { backgroundColor: t.white, borderColor: t.sand300 }]}
        >
          <Text style={[styles.wchipText, { color: t.ink500 }]}>More</Text>
          <SpIcon name="chevRight" size={16} color={t.ink500} strokeWidth={2} />
        </SpPress>
      </View>
      <View style={styles.wtoks}>
        {rows.map((row, ri) => (
          <View key={ri}>
            <Text style={[over(t), { paddingTop: ri === 0 ? 0 : 20, paddingBottom: 4 }]}>{row.header}</Text>
            {row.tokens.map((token) => (
              <View key={token.key} style={[styles.wtok, { borderBottomColor: t.sand300 }]}>
                <Text style={[styles.rm, { color: t.ink800, fontFamily: rmFont }]}>{token.word}</Text>
                <View style={styles.glCol}>
                  {token.gloss ? <Text style={[styles.gl, { color: t.orange700 }]}>{token.gloss}</Text> : null}
                  {token.gloss2 ? <Text style={[styles.gl2, { color: t.ink500 }]}>{token.gloss2}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </SpCard>
  )
}

/* ---------------- Meaning ---------------- */

export function SpMeaning({
  t,
  central,
  rows,
}: {
  t: SpTheme
  central: string | null
  /** `Line 1 · EN` and its text; one unlabelled row when the meaning is prose */
  rows: Array<{ label: string; text: string }>
}) {
  return (
    <SpCard t={t}>
      {central ? (
        <View style={[styles.central, { backgroundColor: t.sage200 }]}>
          <Text style={[over(t), { color: t.sage700 }]}>Central idea</Text>
          <Text style={{ fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22.4, color: t.sage900 }}>{central}</Text>
        </View>
      ) : null}
      <View style={styles.mlist}>
        {rows.map((row, i) => (
          <View
            key={i}
            style={[styles.lnrow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.sand300 }]}
          >
            {row.label ? <Text style={[over(t), { fontVariant: ["tabular-nums"] }]}>{row.label}</Text> : null}
            <Text style={bodyT(t)}>{row.text}</Text>
          </View>
        ))}
      </View>
    </SpCard>
  )
}

/* ---------------- Explain ---------------- */

export function SpExplain({ t, explanation, onAsk }: { t: SpTheme; explanation: SongExplanation; onAsk: () => void }) {
  return (
    <SpCard t={t}>
      <SpTcHead t={t} label="Explained in plain words" />
      <Text style={bodyT(t)}>{explanation.summary}</Text>
      <View style={styles.plist}>
        {explanation.keyPoints.map((point, i) => (
          <View key={i} style={styles.pt}>
            <View style={[styles.ptDot, { backgroundColor: t.orange500 }]} />
            <Text style={[styles.ptText, { color: t.ink800 }]}>{point}</Text>
          </View>
        ))}
      </View>
      <SpTcHead t={t} label="Key terms" />
      <View style={styles.tlist}>
        {explanation.keyTerms.map((term, i) => (
          <View key={i} style={[styles.term, { backgroundColor: t.sand100 }]}>
            <Text style={[styles.termB, { color: t.ink800 }]}>{term.term}</Text>
            <Text style={[styles.termS, { color: t.ink500 }]}>{term.meaning}</Text>
          </View>
        ))}
      </View>
      <SpPill t={t} label="Ask about this song" onPress={onAsk} style={{ alignSelf: "flex-start" }} />
      <Text style={note(t)}>
        Written by AI from the song text and the discourse notes. It can be wrong. Check it against the source.
      </Text>
    </SpCard>
  )
}

/* ---------------- Chords ---------------- */

/** One chord box: 66 x 68 drawing from the prototype's path data, name and what it sounds like. */
function ChordBox({ t, card }: { t: SpTheme; card: ChordCard }) {
  const d = diagramFor(card.name, card.frets)
  return (
    <View style={[styles.ccard, { backgroundColor: t.sand100 }]}>
      <Svg width={66} height={68} viewBox="0 0 74 76" style={styles.cdg}>
        <Path d={d.grid} fill="none" stroke={t.ink300} strokeWidth={1} />
        {d.nut ? <Path d={d.nut} fill="none" stroke={t.ink800} strokeWidth={3} /> : null}
        {d.bar ? <Path d={d.bar} fill="none" stroke={t.orange500} strokeWidth={7} strokeLinecap="round" /> : null}
        <Path d={d.dots} fill={t.orange500} stroke="none" />
        <Path d={d.open} fill="none" stroke={t.ink800} strokeWidth={1.4} />
        <Path d={d.mute} fill="none" stroke={t.ink800} strokeWidth={1.4} strokeLinecap="round" />
        {d.fl ? (
          <SvgText x={0} y={30} fill={t.ink500} fontSize={9} fontWeight="700">
            {d.fl}
          </SvgText>
        ) : null}
      </Svg>
      <Text style={[styles.ccardB, { color: t.ink800 }]}>{card.name}</Text>
      <Text style={[styles.ccardS, { color: t.ink500 }]}>{card.sub}</Text>
    </View>
  )
}

/** `.keyrow`: a label with its note on the left, minus / value / plus on the right. */
export function SpKeyRow({
  t,
  label,
  noteText,
  value,
  onDown,
  onUp,
  downLabel,
  upLabel,
}: {
  t: SpTheme
  label: string
  noteText: string
  value: string
  onDown: () => void
  onUp: () => void
  downLabel: string
  upLabel: string
}) {
  return (
    <View style={styles.keyrow}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={over(t)}>{label}</Text>
        <Text style={note(t)}>{noteText}</Text>
      </View>
      <View style={styles.keyctl}>
        <SpRound t={t} tone="sand" icon="minus" iconSize={20} label={downLabel} onPress={onDown} />
        <Text style={[styles.kn, { color: t.ink800 }]}>{value}</Text>
        <SpRound t={t} tone="sand" icon="plus" iconSize={20} label={upLabel} onPress={onUp} />
      </View>
    </View>
  )
}

export type SpChordToken = { key: string; chord: string; word: string; swara: string; lineBreak?: boolean }

export function SpChords({
  t,
  instrument,
  onInstrument,
  capo,
  capoNoteText,
  onCapoDown,
  onCapoUp,
  capoHintText,
  capoHintAction,
  onCapoBest,
  cards,
  mode,
  onMode,
  keyName,
  keyNoteText,
  onKeyDown,
  onKeyUp,
  swaras,
  onHow,
  strum,
  tokens,
  script,
}: {
  t: SpTheme
  instrument: "guitar" | "harmonium"
  onInstrument: (i: "guitar" | "harmonium") => void
  capo: string
  capoNoteText: string
  onCapoDown: () => void
  onCapoUp: () => void
  capoHintText: string
  capoHintAction: string
  onCapoBest: () => void
  cards: ChordCard[]
  mode: "shapes" | "sounding"
  onMode: (m: "shapes" | "sounding") => void
  keyName: string
  keyNoteText: string
  onKeyDown: () => void
  onKeyUp: () => void
  swaras: Array<{ s: string; n: string }>
  onHow: () => void
  strum: string
  tokens: SpChordToken[]
  script: ScriptId
}) {
  const wordFont = script === "devanagari" ? amFonts.devanagari : script === "bengali" ? amFonts.bengali : amFonts.medium
  return (
    <SpCard t={t}>
      <View style={styles.scripts}>
        <SpChip t={t} size="sm" label="Guitar" on={instrument === "guitar"} onPress={() => onInstrument("guitar")} />
        <SpChip t={t} size="sm" label="Harmonium" on={instrument === "harmonium"} onPress={() => onInstrument("harmonium")} />
      </View>
      {instrument === "guitar" ? (
        <>
          <SpKeyRow
            t={t}
            label="Capo"
            noteText={capoNoteText}
            value={capo}
            onDown={onCapoDown}
            onUp={onCapoUp}
            downLabel="Lower the capo"
            upLabel="Raise the capo"
          />
          <SpPress
            onPress={onCapoBest}
            accessibilityLabel={capoHintText}
            style={[styles.capohint, { backgroundColor: t.sage200 }]}
          >
            <Text style={[styles.capohintText, { color: t.sage900 }]}>{capoHintText}</Text>
            {capoHintAction ? <Text style={[styles.capohintGo, { color: t.orange700 }]}>{capoHintAction}</Text> : null}
          </SpPress>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ccards}
            contentContainerStyle={styles.ccardsIn}
          >
            {cards.map((card, i) => (
              <ChordBox key={`${card.name}-${i}`} t={t} card={card} />
            ))}
          </ScrollView>
          <View style={styles.tcHeadWrap}>
            <Text style={over(t)}>Letters above the words</Text>
            <View style={styles.scripts}>
              <SpChip t={t} size="sm" label="Shapes you play" on={mode === "shapes"} onPress={() => onMode("shapes")} />
              <SpChip t={t} size="sm" label="Sounding chords" on={mode === "sounding"} onPress={() => onMode("sounding")} />
            </View>
          </View>
        </>
      ) : (
        <>
          <SpKeyRow
            t={t}
            label="Key"
            noteText={keyNoteText}
            value={keyName}
            onDown={onKeyDown}
            onUp={onKeyUp}
            downLabel="Lower the key"
            upLabel="Raise the key"
          />
          <View style={styles.swaras}>
            {swaras.map((w) => (
              <View key={w.s} style={[styles.swara, { backgroundColor: t.sand100 }]}>
                <Text style={[styles.swaraB, { color: t.ink800 }]}>{w.s}</Text>
                <Text style={[styles.swaraS, { color: t.orange700 }]}>{w.n}</Text>
              </View>
            ))}
          </View>
          <SpPress
            onPress={onHow}
            accessibilityLabel="How chords work on the harmonium"
            style={[styles.cardbtn, { backgroundColor: t.white, borderColor: t.sand300 }]}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={over(t)}>New to it?</Text>
              <Text style={[styles.cardbtnT, { color: t.ink800 }]}>How chords work on the harmonium</Text>
            </View>
            <SpIcon name="chevRight" size={22} color={t.ink500} />
          </SpPress>
        </>
      )}
      <Text style={note(t)}>{strum}</Text>
      <View style={styles.ctoks}>
        {tokens.map((token) =>
          token.lineBreak ? (
            <View key={token.key} style={{ flexBasis: "100%", height: 14 }} />
          ) : (
            <View key={token.key} style={styles.cw}>
              <Text style={[styles.cch, { color: t.orange700 }]}>{token.chord}</Text>
              <Text style={[styles.cwd, { color: t.ink800, fontFamily: wordFont }]}>{token.word}</Text>
              {token.swara ? <Text style={[styles.csw, { color: t.ink500 }]}>{token.swara}</Text> : null}
            </View>
          ),
        )}
      </View>
    </SpCard>
  )
}

/* ---------------- Watch ---------------- */

export function SpWatch({
  t,
  title,
  poster,
  onPlay,
  more,
}: {
  t: SpTheme
  title: string
  poster: ReactNode
  onPlay: () => void
  more: Array<{ name: string; meta: string; len: string; go: () => void }>
}) {
  return (
    <SpCard t={t}>
      <SpPress onPress={onPlay} accessibilityLabel="Play video" style={[styles.vid, { backgroundColor: t.sage900 }]}>
        {poster}
        <View style={[styles.vp, { backgroundColor: t.orange500 }]}>
          <SpIcon name="play" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.vt} numberOfLines={2}>
          {`${title} · video`}
        </Text>
      </SpPress>
      {more.length ? (
        <>
          <SpTcHead t={t} label="More videos" />
          <View>
            {more.map((row, i) => (
              <SpPress
                key={i}
                onPress={row.go}
                accessibilityLabel={row.name}
                style={[styles.recrow, i < more.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.sand300 }]}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[styles.recName, { color: t.ink800 }]}>{row.name}</Text>
                  <Text style={note(t)}>{row.meta}</Text>
                </View>
                <Text style={[styles.recLen, { color: t.orange700 }]}>{row.len}</Text>
              </SpPress>
            ))}
          </View>
        </>
      ) : null}
    </SpCard>
  )
}

const styles = StyleSheet.create({
  wlangs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12, paddingBottom: 6 },
  wchip: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wchipMore: { paddingLeft: 13, paddingRight: 8, gap: 2 },
  wchipText: { fontFamily: amFonts.semi, fontSize: 14 },
  wtoks: { flexDirection: "column" },
  wtok: { flexDirection: "row", alignItems: "center", columnGap: 16, paddingVertical: 13, borderBottomWidth: 1 },
  rm: { flex: 5, fontSize: 19, lineHeight: 24 },
  glCol: { flex: 6, gap: 2 },
  gl: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  gl2: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  central: { padding: 20, paddingVertical: 16, borderRadius: 30, gap: 12 },
  mlist: { gap: 12 },
  lnrow: { paddingVertical: 4, paddingBottom: 12 },
  plist: { gap: 12 },
  pt: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  ptDot: { width: 8, height: 8, borderRadius: 9999, marginTop: 8 },
  ptText: { flex: 1, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22.4 },
  tlist: { gap: 8 },
  term: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, gap: 2 },
  termB: { fontFamily: amFonts.bold, fontSize: 16 },
  termS: { fontFamily: amFonts.medium, fontSize: 14 },
  scripts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tcHeadWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  keyrow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  keyctl: { flexDirection: "row", alignItems: "center", gap: 8 },
  kn: {
    minWidth: 64,
    textAlign: "center",
    fontFamily: amFonts.display,
    fontSize: 24,
    letterSpacing: -0.48,
    fontVariant: ["tabular-nums"],
  },
  capohint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  capohintText: { flex: 1, fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  capohintGo: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 19 },
  ccards: { marginHorizontal: -20, flexGrow: 0 },
  ccardsIn: { paddingHorizontal: 20, gap: 8 },
  ccard: {
    minWidth: 92,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 20,
    alignItems: "center",
    gap: 2,
  },
  cdg: { marginBottom: 4 },
  ccardB: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 26, letterSpacing: -0.52, textAlign: "center" },
  ccardS: { fontFamily: amFonts.semi, fontSize: 13, letterSpacing: 0.26, textAlign: "center", fontVariant: ["tabular-nums"] },
  swaras: { flexDirection: "row", gap: 6 },
  swara: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 10, borderRadius: 20 },
  swaraB: { fontFamily: amFonts.display, fontSize: 15 },
  swaraS: { fontFamily: amFonts.semi, fontSize: 13 },
  cardbtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardbtnT: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  ctoks: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  cw: { alignItems: "flex-start", marginRight: 12, marginBottom: 6 },
  cch: { minHeight: 24, fontFamily: amFonts.display, fontSize: 17, lineHeight: 24, letterSpacing: -0.17 },
  cwd: { fontSize: 19, lineHeight: 26 },
  csw: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.48 },
  vid: { height: 200, borderRadius: 30, overflow: "hidden", width: "100%" },
  vp: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  vt: { position: "absolute", left: 20, right: 20, bottom: 16, color: "#FFFFFF", fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  recrow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    paddingLeft: 20,
    paddingRight: 12,
  },
  recName: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  recLen: { fontFamily: amFonts.semi, fontSize: 14, paddingRight: 12 },
})
