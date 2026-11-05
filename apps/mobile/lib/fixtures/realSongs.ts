import type { SongSummary } from "@prabhat/core"

/**
 * Preview only (MOCKUP_DATA, see lib/mockupMode.ts). The first seven songs of the catalog exactly as
 * the API sends them (GET /api/v1/songs, rows 1 to 7, copied verbatim). Real titles, real numbers.
 *
 * Used for two things only:
 *  1. the catalog of the web preview while the API cannot be reached (no cache either), so the
 *     screens are not empty;
 *  2. the small sample fixtures (saved, downloads, playlists, stories, Home) that point at PS 1 to 7
 *     and need a title without waiting for the network.
 *
 * Accented letters are written as \u escapes so the text is byte for byte the API's (decomposed Unicode).
 * Nothing here is invented. Delete it when the preview always has the live catalog.
 */
export const REAL_SONGS_1_TO_7: readonly SongSummary[] = [
  { number: 1, title: "BANDHU HE NIYE CALO", first_line: "BANDHU HE NIYE CALO", theme: null, occasion: null, mood: "hopeful", language: "Roman", difficulty: "easy", is_verified: true },
  { number: 2, title: "E GA\u0301N A\u0301MA\u0301R, A\u0301LOR JHARAN\u0301A\u0301 DHA\u0301RA\u0301", first_line: "E GA\u0301N A\u0301MA\u0301R, A\u0301LOR JHARAN\u0301A\u0301 DHA\u0301RA\u0301", theme: "Song of Liberation", occasion: null, mood: null, language: "Roman", difficulty: "easy", is_verified: true },
  { number: 3, title: "A\u0301NDHA\u0301RA SHES\u0301E A\u0301LORA DESHE", first_line: "A\u0301NDHA\u0301RA SHES\u0301E A\u0301LORA DESHE", theme: "Song of Neohumanism", occasion: null, mood: null, language: "Roman", difficulty: "easy", is_verified: true },
  { number: 4, title: "SAKAL MANER VIIN\u0301A\u0301 EK SURE BA\u0301JE A\u0301J", first_line: "SAKAL MANER VIIN\u0301A\u0301 EK SURE BA\u0301JE A\u0301J", theme: "Song of Sweetness", occasion: null, mood: null, language: "Roman", difficulty: "easy", is_verified: true },
  { number: 5, title: "ELO, ANEK JUGER SEI AJA\u0301NA\u0301 PATHIK", first_line: "ELO, ANEK JUGER SEI AJA\u0301NA\u0301 PATHIK", theme: "Song of Fulfillment", occasion: null, mood: null, language: "Roman", difficulty: "easy", is_verified: true },
  { number: 6, title: "BANDHU A\u0301MA\u0301R", first_line: "BANDHU A\u0301MA\u0301R", theme: "Song of Awakening", occasion: null, mood: null, language: "Roman", difficulty: "easy", is_verified: true },
  { number: 7, title: "NIIRAVATA\u0301 MA\u0301JHE KE GO TUMI ELE", first_line: "NIIRAVATA\u0301 MA\u0301JHE KE GO TUMI ELE", theme: "Song of Buddha", occasion: "Song in memory of Lord Buddha", mood: null, language: "Roman", difficulty: "easy", is_verified: true },
]
