/** Keep one in-page audio element playing — song pages mount a single player per viewport. */
export function bindExclusiveAudio(audio: HTMLAudioElement): () => void {
  const onPlay = () => {
    for (const other of document.querySelectorAll("audio")) {
      if (other !== audio && !other.paused) {
        other.pause()
      }
    }
  }
  audio.addEventListener("play", onPlay)
  return () => audio.removeEventListener("play", onPlay)
}
