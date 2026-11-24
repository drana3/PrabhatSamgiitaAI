import {
  festivalObservanceExploreQuery,
  type FestivalObservance,
} from "@prabhat/core"

export { festivalObservanceExploreQuery as festivalExploreQuery }

export type FestivalExploreInput = {
  month: number
  day: number
  year?: number
  title: string
  festival?: string
  theme?: string
  collectionLabel?: string
  relatedCollectionLabel?: string
  catalogSongNumbers?: number[]
}

export function festivalExploreQueryFromRecord(input: FestivalExploreInput) {
  const obs: FestivalObservance = {
    id: `${input.month}-${input.day}-${input.year ?? ""}`,
    title: input.title,
    subtitle: "",
    month: input.month,
    day: input.day,
    year: input.year ?? new Date().getFullYear(),
    festival: input.festival,
    theme: input.theme,
    collectionLabel: input.collectionLabel ?? input.relatedCollectionLabel,
    catalogSongNumbers: input.catalogSongNumbers,
  }
  return festivalObservanceExploreQuery(obs)
}