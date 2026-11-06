import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { CommunityChords } from "@/components/song-chords/CommunityChords";
import { SpEmptyNote } from "@/components/song-v2/SpHonest";
import { SpIcon } from "@/components/song-v2/SpIcon";
import {
  ChordBox,
  SpChordTokens,
  SpKeyRow,
  type SpChordToken,
} from "@/components/song-v2/SpSections";
import { SpPill, SpPress } from "@/components/song-v2/SpUi";
import type { SpTheme } from "@/constants/tokens/amSong";
import { amFonts } from "@/constants/tokens/amTypography";
import {
  columnsInScript,
  layoutChart,
  type WordColumn,
} from "@/lib/songPage/chordChart";
import { requestKey } from "@/lib/songPage/honest";
import { usePageT } from "@/lib/songPage/pageCopy";
import {
  capoHint,
  capoName,
  guitarKeyNote,
  harmoniumChord,
  harmoniumKeyNote,
  keyLabel,
  shapeCards,
  spBestCapo,
  spShape,
  strumNote,
  swaraAt,
  swaraRow,
  uniqueChords,
} from "@/lib/songPage/spChords";
import { useSongPageStore } from "@/stores/songPageStore";
import { href } from "@/utils/href";

import type { PageUi } from "./state";
import { DemoTag, Eyebrow, SectionTitle, Segmented } from "./ui";
import type { SongPageModel } from "./useSongPageModel";

/** The chords of a song that has them (the preview's demo songs): diagrams, or letters over the lyrics, one instrument at a time. */
function ChordsBody({
  t,
  model,
  ui,
}: {
  t: SpTheme;
  model: SongPageModel;
  ui: PageUi;
}) {
  const tr = usePageT();
  const router = useRouter();
  const { chart, lines, sources } = model;
  const instrument = useSongPageStore((s) => s.instrument);
  const capo = useSongPageStore((s) => s.capo);
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey);
  const settings = useSongPageStore.getState;
  const tokens: SpChordToken[] = useMemo(() => {
    if (!chart) return [];
    // the letters over the lyrics are the shapes you play (with the capo on), the one reading that needs no explaining
    const showChord = (chord: string) =>
      instrument === "harmonium"
        ? harmoniumChord(chord, chart.baseKey, harmoniumKey)
        : spShape(chord, capo);
    const laid = layoutChart(sources.roman, chart, showChord, true);
    const out: SpChordToken[] = [];
    lines.primary.forEach((line, li) => {
      const base = laid[li] ?? [];
      const columns: WordColumn[] =
        lines.primaryScript === "roman"
          ? base
          : (columnsInScript(base, line) ?? base);
      columns.forEach((column, wi) =>
        out.push({
          key: `${li}-${wi}`,
          chord: column.chord ?? "",
          word: column.word,
          swara: instrument === "harmonium" ? swaraAt(li, wi) : "",
        }),
      );
      out.push({
        key: `br-${li}`,
        chord: "",
        word: "",
        swara: "",
        lineBreak: true,
      });
    });
    return out;
  }, [chart, sources.roman, lines, instrument, capo, harmoniumKey]);
  if (!chart) return null;
  const sounding = uniqueChords(
    chart.lines.flatMap((line) => line.placements.map((p) => p.chord)),
  );
  const hint = capoHint(sounding, capo);
  const wordFont =
    lines.primaryScript === "devanagari"
      ? amFonts.devanagari
      : lines.primaryScript === "bengali"
        ? amFonts.bengali
        : amFonts.medium;
  const guitar = instrument === "guitar";
  return (
    <View style={styles.body}>
      <DemoTag t={t} />
      <View style={styles.pad}>
        <Segmented
          t={t}
          equal
          label={tr("songPage.chords.view.a11y")}
          value={ui.chordView}
          onChange={ui.setChordView}
          items={[
            { id: "diagrams", label: tr("songPage.chords.view.diagrams") },
            { id: "lyrics", label: tr("songPage.chords.view.lyrics") },
          ]}
        />
        <Segmented
          t={t}
          equal
          label={tr("songPage.chords.title")}
          value={instrument}
          onChange={(next) => settings().setInstrument(next)}
          items={[
            { id: "guitar", label: tr("songPage.chords.instrument.guitar") },
            {
              id: "harmonium",
              label: tr("songPage.chords.instrument.harmonium"),
            },
          ]}
        />
      </View>

      <Eyebrow t={t} style={styles.eyebrow}>
        {tr("songPage.chords.transpose")}
      </Eyebrow>
      {guitar ? (
        <>
          <View style={styles.keyPad}>
            <SpKeyRow
              t={t}
              label={tr("songPage.chords.capo")}
              noteText={guitarKeyNote(sounding, capo)}
              value={capoName(capo)}
              onDown={() => settings().setCapo(capo - 1)}
              onUp={() => settings().setCapo(capo + 1)}
              downLabel={tr("songPage.chords.capo.lower")}
              upLabel={tr("songPage.chords.capo.raise")}
            />
          </View>
          <SpPress
            onPress={() => settings().setCapo(spBestCapo(sounding))}
            accessibilityLabel={hint.text}
            style={[
              styles.hint,
              { backgroundColor: t.dark ? t.sand100 : t.sage200 },
            ]}
          >
            <Text
              style={[
                styles.hintText,
                { color: t.dark ? t.ink900 : t.sage900 },
              ]}
            >
              {hint.text}
            </Text>
            <Text style={[styles.hintGo, { color: t.accentText }]}>
              {hint.action}
            </Text>
          </SpPress>
        </>
      ) : (
        <View style={styles.keyPad}>
          <SpKeyRow
            t={t}
            label={tr("songPage.chords.key")}
            noteText={harmoniumKeyNote(harmoniumKey)}
            value={keyLabel(harmoniumKey)}
            onDown={() => settings().stepHarmoniumKey(-1)}
            onUp={() => settings().stepHarmoniumKey(1)}
            downLabel={tr("songPage.chords.key.lower")}
            upLabel={tr("songPage.chords.key.raise")}
          />
        </View>
      )}

      {ui.chordView === "diagrams" ? (
        guitar ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
          >
            {shapeCards(sounding, capo).map((card, i) => (
              <ChordBox key={`${card.name}-${i}`} t={t} card={card} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.swaras}>
            {swaraRow(harmoniumKey).map((w) => (
              <View
                key={w.s}
                style={[styles.swara, { backgroundColor: t.sand100 }]}
              >
                <Text style={[styles.swaraB, { color: t.ink800 }]}>{w.s}</Text>
                <Text style={[styles.swaraS, { color: t.accentText }]}>
                  {w.n}
                </Text>
              </View>
            ))}
          </View>
        )
      ) : (
        <View style={styles.pad}>
          <Text style={[styles.strum, { color: t.ink500 }]}>
            {strumNote(instrument, chart.strum)}
          </Text>
          <SpChordTokens t={t} tokens={tokens} wordFont={wordFont} />
        </View>
      )}

      {!guitar && ui.chordView === "diagrams" ? (
        <SpPress
          onPress={() => router.push(href("/harmonium-v2/chords"))}
          accessibilityLabel={tr("songPage.chords.howHarmonium")}
          style={[
            styles.how,
            { backgroundColor: t.white, borderColor: t.sand300 },
          ]}
        >
          <Text style={[styles.howText, { color: t.ink800 }]}>
            {tr("songPage.chords.howHarmonium")}
          </Text>
          <SpIcon name="chevRight" size={20} color={t.ink500} />
        </SpPress>
      ) : null}
    </View>
  );
}

/** Section 4: chords. A one-line explanation of the two views under the header; real chords, or the honest empty state. */
export function ChordsSection({
  t,
  model,
  ui,
}: {
  t: SpTheme;
  model: SongPageModel;
  ui: PageUi;
}) {
  const tr = usePageT();
  const key = model.song ? requestKey("chords", model.song.number) : "";
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.chords")}</SectionTitle>
      {model.chart ? (
        <Text style={[styles.intro, { color: t.ink500 }]}>
          {tr("songPage.chords.intro")}
        </Text>
      ) : (
        <View style={{ height: 4 }} />
      )}
      {model.chart ? (
        <ChordsBody t={t} model={model} ui={ui} />
      ) : (
        <View style={styles.empty}>
          <SpEmptyNote
            t={t}
            text={
              model.notationUrl
                ? `${tr("songPage.chords.none")} ${tr("songPage.chords.pdfNote")}`
                : tr("songPage.chords.none")
            }
            requested={ui.requested.includes(key)}
            onRequest={() => {
              ui.request(key);
              model.sendNote();
            }}
            requestLabel={tr("songPage.chords.request")}
            link={
              model.notationUrl
                ? {
                    label: tr("songPage.chords.notationPdf"),
                    url: model.notationUrl,
                  }
                : null
            }
          />
        </View>
      )}
      {model.song ? (
        <CommunityChords
          t={t}
          songNumber={model.song.number}
          romanLines={model.sources.roman}
        />
      ) : null}
      <View style={styles.sing}>
        <SpPill
          t={t}
          variant="sand"
          icon="play"
          label={tr("songPage.chords.sing")}
          onPress={model.openKaraoke}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: amFonts.medium,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  body: { gap: 12 },
  pad: { paddingHorizontal: 20, gap: 8 },
  eyebrow: { paddingHorizontal: 20, paddingTop: 4 },
  keyPad: { paddingHorizontal: 20 },
  hint: {
    marginHorizontal: 20,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    gap: 2,
  },
  hintText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  hintGo: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  cards: { paddingHorizontal: 20, gap: 8 },
  swaras: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
  },
  swara: {
    minWidth: 44,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  swaraB: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  swaraS: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16 },
  strum: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  how: {
    marginHorizontal: 20,
    minHeight: 56,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  howText: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  empty: { paddingBottom: 4 },
  sing: { paddingHorizontal: 20, paddingTop: 16, flexDirection: "row" },
});
