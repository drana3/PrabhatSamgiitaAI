import { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { useVariantT } from "@/lib/songPageVariants/copy"
import { variantLayout } from "@/lib/songPageVariants/layout"

import { Actions, FadeHero, fadeHeight, songTitle } from "./Hero"
import { LyricsBlock, LyricsToolbar, WordOverlay } from "./LyricsBlock"
import { MeaningHeader, MeaningPage } from "./Meaning"
import { PlayPanel } from "./Play"
import { PageSheets } from "./Sheets"
import { Shell, useBarHeight } from "./Shell"
import { ChevronRow, Pills } from "./ui"
import { usePageUi } from "./state"
import type { SongVariantModel } from "./useSongVariantModel"
import { WatchPanel } from "./Watch"

type Tab = "lyrics" | "meaning" | "play" | "watch"
const STRIP = 64

/** B "Pages": a photo that fades into the page, the action row, four pills that swap the content, About below. */
export function VariantB({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  const ui = usePageUi()
  const bar = useBarHeight()
  const [tab, setTab] = useState<Tab>("lyrics")
  const layout = useMemo(() => variantLayout("b", model.facts), [model.facts])
  const items = layout.tabs.map((id) => ({ id: id as Tab, label: tr(`songVariant.tab.${id}` as "songVariant.tab.lyrics") }))
  return (
    <Shell
      t={t}
      model={model}
      title={songTitle(model)}
      top="photo"
      heroHeight={fadeHeight(bar)}
      hero={
        <>
          <FadeHero t={t} model={model} />
          <Actions t={t} model={model} />
        </>
      }
      strip={<Pills t={t} items={items} active={tab} onSelect={(id) => { setTab(id); ui.setSelected(null) }} />}
      stripHeight={STRIP}
      onMore={() => model.setSheet("actions")}
      overlay={<WordOverlay t={t} model={model} ui={ui} bottom={96} />}
      sheets={<PageSheets t={t} model={model} ui={ui} />}
    >
      <View style={styles.page}>
        {tab === "lyrics" ? (
          <>
            <LyricsToolbar t={t} model={model} ui={ui} wordsChip={layout.wordsChip} />
            <LyricsBlock t={t} model={model} ui={ui} showNote={layout.wordsNote && model.lines.primary.length > 0} />
          </>
        ) : null}
        {tab === "meaning" ? (
          <>
            <MeaningHeader t={t} meaning={model.meaning} onChange={() => ui.setSheet("meaning")} />
            <MeaningPage t={t} meaning={model.meaning} showSource />
          </>
        ) : null}
        {tab === "play" ? <PlayPanel t={t} model={model} /> : null}
        {tab === "watch" ? <WatchPanel t={t} model={model} /> : null}
        <View style={styles.about}>
          <ChevronRow t={t} title={tr("songVariant.about.row")} subtitle={tr("songVariant.about.title")} onPress={() => ui.setSheet("about")} last />
        </View>
      </View>
    </Shell>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 4 },
  about: { marginTop: 32 },
})
