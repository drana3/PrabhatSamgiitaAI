/**
 * Why a song did not play (see lib/playback/playerError.ts). English is the source; ru and es mirror it.
 */
export const playerErrorsEn = {
  "player.error.noStream": "This song has no audio in the app yet.",
  "player.error.offline": "You are offline. Download this song to play it without internet.",
  "player.error.failed": "The song could not be played. Tap play to try again.",
  "player.error.timeout": "The song is taking too long to start. Check your connection and tap play to try again.",
  "player.error.removed": "The saved copy was removed. Connect to the internet to stream it, or download it again.",
} as const

export const playerErrorsEs = {
  "player.error.noStream": "Esta canción aún no tiene audio en la app.",
  "player.error.offline": "Estás sin conexión. Descarga esta canción para escucharla sin internet.",
  "player.error.failed": "No se pudo reproducir la canción. Toca reproducir para intentarlo de nuevo.",
  "player.error.timeout": "La canción tarda demasiado en empezar. Revisa tu conexión y toca reproducir para intentarlo de nuevo.",
  "player.error.removed": "Se quitó la copia guardada. Conéctate a internet para escucharla o descárgala de nuevo.",
} as const

export const playerErrorsRu = {
  "player.error.noStream": "У этой песни пока нет аудио в приложении.",
  "player.error.offline": "Вы офлайн. Скачайте песню, чтобы слушать её без интернета.",
  "player.error.failed": "Песню не удалось воспроизвести. Нажмите «играть», чтобы попробовать снова.",
  "player.error.timeout": "Песня слишком долго запускается. Проверьте соединение и нажмите «играть», чтобы попробовать снова.",
  "player.error.removed": "Сохранённая копия удалена. Подключитесь к интернету, чтобы слушать онлайн, или скачайте снова.",
} as const
