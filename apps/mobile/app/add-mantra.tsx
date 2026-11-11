import { Redirect } from "expo-router"

import { href } from "@/utils/href"

/**
 * Old address of the page of Others. Others is now a type of the one Add Recording form (Dada, 12 Nov 2026), so an old link, a pushed
 * notification or a bookmark lands there with the type already on Others.
 */
export default function AddMantraScreen() {
  return <Redirect href={href("/add-kirtan?kind=other_mantra")} />
}
