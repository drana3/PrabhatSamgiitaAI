type CatalogPlaybackHost = {
  onQueueEnded: () => void
  onPlaybackError: () => void
}

let host: CatalogPlaybackHost | null = null

export function setCatalogPlaybackHost(next: CatalogPlaybackHost | null): void {
  host = next
}

export function notifyCatalogQueueEnded(): void {
  host?.onQueueEnded()
}

export function notifyCatalogPlaybackError(): void {
  host?.onPlaybackError()
}
