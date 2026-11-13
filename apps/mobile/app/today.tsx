import { useLocalSearchParams } from "expo-router"

import { HomeScreen } from "@/components/home/HomeScreen"
import TodayPrototypeScreen from "@/components/today/TodayPrototypeScreen"

/**
 * Today tab. The shelf-style Home is the default; `/today?layout=prototype` keeps the Claude
 * design prototype's Today (colour sets, sample days) reachable for review.
 */
export default function TodayRoute() {
  const { layout } = useLocalSearchParams<{ layout?: string }>()
  return layout === "prototype" ? <TodayPrototypeScreen /> : <HomeScreen />
}
