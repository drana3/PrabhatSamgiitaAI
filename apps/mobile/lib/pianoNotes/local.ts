import { bookletPianoSheet } from "./booklet"
import { collectionPianoSheet } from "./collection"
import type { PianoSheet } from "./types"

/**
 * The notes that ship inside the app, no server needed: the booklet's (songs 1, 2, 27) win; for the other songs
 * of the collection "50 PS" the sheet read from the PDF is used. One local sheet per song.
 */
export function localPianoSheet(songNumber: number): PianoSheet | null {
  return bookletPianoSheet(songNumber) ?? collectionPianoSheet(songNumber)
}

/** Ids of the sheets that live in the app (not on the server): `booklet-1`, `collection-5`. */
export function isLocalSheetId(id: string): boolean {
  return id.startsWith("booklet-") || id.startsWith("collection-")
}
