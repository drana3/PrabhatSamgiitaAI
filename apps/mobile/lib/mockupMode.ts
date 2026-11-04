/**
 * Preview-only switch. When EXPO_PUBLIC_MOCKUP_DATA=1 (set by `npm run web`), screens show the
 * Claude design prototype's sample data (songs, words, durations, stats, playing state) instead
 * of live API data, so the app can be compared 1:1 with the mockup. Always off in release builds.
 */
export const MOCKUP_DATA: boolean = process.env.EXPO_PUBLIC_MOCKUP_DATA === "1"
