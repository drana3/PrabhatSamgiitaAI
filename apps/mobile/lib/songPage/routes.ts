/**
 * Routes this page links to. The Learn-a-song path (SCR-21) is built on another
 * branch; change this one function when its route is known.
 */
export function learnSongRoute(songId: string): string {
  return `/learn/song/${songId}`
}

export function askAboutSongRoute(songNumber: number): string {
  return `/(tabs)/ai?song=${songNumber}`
}
