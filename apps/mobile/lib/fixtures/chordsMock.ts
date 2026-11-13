/**
 * Preview only (EXPO_PUBLIC_MOCKUP_DATA=1): which songs "have chords", so Search can show its "With chords" block in the
 * browser preview, where the server's list is not read. A real build asks the API (`GET /api/v1/song-chords/with-chords`).
 */
export const MOCK_SONGS_WITH_CHORDS: ReadonlySet<number> = new Set([1, 2, 3, 7, 11, 17, 24])
