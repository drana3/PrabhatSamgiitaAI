export function bindExclusiveAudioPlayback(audio: HTMLAudioElement) {
  function pauseOthers() {
    document.querySelectorAll("audio").forEach((element) => {
      if (element !== audio && !element.paused) element.pause()
    })
  }

  audio.addEventListener("play", pauseOthers)
  return () => audio.removeEventListener("play", pauseOthers)
}
