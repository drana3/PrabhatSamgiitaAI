/**
 * Radio player (variant D), speed, sleep timer, smooth transitions and "Continue from ..." (player-v2 and the
 * profile settings). English is the source; ru and es mirror it key for key. Spread into the main dictionaries.
 * Spelling: "Kiirtan" with two i's in visible strings.
 */
export const playbackControlsEn = {
  // Radio player
  "radio.player.label": "Radio",
  "radio.player.nowPlaying": "Now playing · {channel}",
  "radio.player.stop": "Stop the Radio",
  "radio.player.menu": "Radio options: speed, sleep timer, normal view",
  "radio.player.mix": "Mix several categories",
  "radio.player.mix.title": "What to play",
  "radio.player.mix.sub": "Tap to add or remove a category. The change starts with the next track.",
  "radio.channel.all": "All",
  "radio.channel.a11y": "{name} channel, {count} tracks",
  "radio.channel.all.a11y": "All categories",
  "radio.player.normalView": "Normal player view",
  "radio.player.normalView.meta": "Lyrics, queue and all the buttons",
  "radio.player.radioView": "Radio view",
  "radio.player.radioView.meta": "Channels and big buttons",
  "radio.player.photo.a11y": "Picture for this track",

  // Speed
  "playback.speed.title": "Speed",
  "playback.speed.meta": "From 0.5× to 2×",
  "playback.speed.slower": "Slower",
  "playback.speed.faster": "Faster",
  "playback.speed.reset": "Normal speed",
  "playback.speed.keepPitch": "Keep the pitch",
  "playback.speed.keepPitch.sub": "The voice does not get higher or lower when the speed changes",
  "playback.speed.pitchNote":
    "Turned off, the pitch follows the speed. That works on iPhone only and starts with the next recording. Steps of a semitone need a different audio engine.",
  "playback.speed.remember": "Remember for this recording",
  "playback.speed.remember.sub": "It starts at this speed next time",
  "playback.speed.default": "Use for all recordings",
  "playback.speed.default.sub": "Now: {rate}",

  // Sleep timer
  "playback.sleep.title": "Sleep timer",
  "playback.sleep.min": "{minutes} min",
  "playback.sleep.endTrack": "End of this track",
  "playback.sleep.endList": "End of the playlist",
  "playback.sleep.off": "Cancel the timer",
  "playback.sleep.left": "{time} left",
  "playback.sleep.note": "The sound fades out gently at the end. The timer keeps working when the screen is off.",
  "playback.sleep.chip": "Sleep {time}",
  "playback.sleep.chip.a11y": "Sleep timer, {time} left. Tap to cancel",
  "player.sleep.endOfList": "End of playlist",
  "player.sleep.toastEndList": "Sleep timer: end of playlist",

  // Smooth transitions
  "profile.transitions": "Smooth transitions",
  "transitions.sheet.a11y": "Smooth transitions",
  "transitions.title": "Smooth transitions",
  "transitions.intro":
    "At the end of a track the sound fades out, and the next track fades in. It sounds like a radio station instead of a hard cut.",
  "transitions.radio": "In the Radio",
  "transitions.radio.sub": "On by default",
  "transitions.list": "In playlists and queues",
  "transitions.list.sub": "Off by default",
  "transitions.off": "Off",
  "transitions.seconds": "{seconds} s",
  "transitions.less": "Shorter",
  "transitions.more": "Longer",
  "transitions.note.engine":
    "The two tracks do not play over each other: one fades out, then the next fades in. A true overlap needs a second audio player and is not used yet.",
  "transitions.note.web": "The browser preview has no sound, so this is only visible on a phone.",

  // Continue from where you stopped (long recordings)
  "player.continue.from": "Continue from {time}",
} as const

export const playbackControlsEs = {
  "radio.player.label": "Radio",
  "radio.player.nowPlaying": "Suena ahora · {channel}",
  "radio.player.stop": "Detener la Radio",
  "radio.player.menu": "Opciones de la Radio: velocidad, temporizador, vista normal",
  "radio.player.mix": "Mezclar varias categorías",
  "radio.player.mix.title": "Qué reproducir",
  "radio.player.mix.sub": "Toca para añadir o quitar una categoría. El cambio empieza con la pista siguiente.",
  "radio.channel.all": "Todo",
  "radio.channel.a11y": "Canal {name}, {count} pistas",
  "radio.channel.all.a11y": "Todas las categorías",
  "radio.player.normalView": "Vista normal del reproductor",
  "radio.player.normalView.meta": "Letra, cola y todos los botones",
  "radio.player.radioView": "Vista de Radio",
  "radio.player.radioView.meta": "Canales y botones grandes",
  "radio.player.photo.a11y": "Imagen de esta pista",

  "playback.speed.title": "Velocidad",
  "playback.speed.meta": "De 0,5× a 2×",
  "playback.speed.slower": "Más lento",
  "playback.speed.faster": "Más rápido",
  "playback.speed.reset": "Velocidad normal",
  "playback.speed.keepPitch": "Mantener el tono",
  "playback.speed.keepPitch.sub": "La voz no sube ni baja al cambiar la velocidad",
  "playback.speed.pitchNote":
    "Desactivado, el tono sigue a la velocidad. Funciona solo en iPhone y empieza con la grabación siguiente. Los pasos de un semitono necesitan otro motor de audio.",
  "playback.speed.remember": "Recordar para esta grabación",
  "playback.speed.remember.sub": "La próxima vez empieza a esta velocidad",
  "playback.speed.default": "Usar para todas las grabaciones",
  "playback.speed.default.sub": "Ahora: {rate}",

  "playback.sleep.title": "Temporizador de sueño",
  "playback.sleep.min": "{minutes} min",
  "playback.sleep.endTrack": "Al final de esta pista",
  "playback.sleep.endList": "Al final de la lista",
  "playback.sleep.off": "Cancelar el temporizador",
  "playback.sleep.left": "Quedan {time}",
  "playback.sleep.note": "El sonido baja poco a poco al final. El temporizador sigue funcionando con la pantalla apagada.",
  "playback.sleep.chip": "Sueño {time}",
  "playback.sleep.chip.a11y": "Temporizador de sueño, quedan {time}. Toca para cancelar",
  "player.sleep.endOfList": "Fin de la lista",
  "player.sleep.toastEndList": "Temporizador: al final de la lista",

  "profile.transitions": "Transiciones suaves",
  "transitions.sheet.a11y": "Transiciones suaves",
  "transitions.title": "Transiciones suaves",
  "transitions.intro":
    "Al final de una pista el sonido baja y la siguiente sube poco a poco. Suena como una emisora de radio y no como un corte brusco.",
  "transitions.radio": "En la Radio",
  "transitions.radio.sub": "Activado de serie",
  "transitions.list": "En listas y colas",
  "transitions.list.sub": "Desactivado de serie",
  "transitions.off": "Desactivado",
  "transitions.seconds": "{seconds} s",
  "transitions.less": "Más corto",
  "transitions.more": "Más largo",
  "transitions.note.engine":
    "Las dos pistas no suenan a la vez: una baja y luego sube la siguiente. Un solapamiento real necesita un segundo reproductor de audio y aún no se usa.",
  "transitions.note.web": "La vista previa del navegador no tiene sonido, así que solo se nota en un teléfono.",

  "player.continue.from": "Continuar desde {time}",
} as const

export const playbackControlsRu = {
  "radio.player.label": "Радио",
  "radio.player.nowPlaying": "Сейчас играет · {channel}",
  "radio.player.stop": "Остановить радио",
  "radio.player.menu": "Настройки радио: скорость, таймер сна, обычный вид",
  "radio.player.mix": "Смешать несколько категорий",
  "radio.player.mix.title": "Что играть",
  "radio.player.mix.sub": "Нажмите, чтобы добавить или убрать категорию. Изменение начнётся со следующей записи.",
  "radio.channel.all": "Всё",
  "radio.channel.a11y": "Канал {name}, записей: {count}",
  "radio.channel.all.a11y": "Все категории",
  "radio.player.normalView": "Обычный вид плеера",
  "radio.player.normalView.meta": "Слова, очередь и все кнопки",
  "radio.player.radioView": "Вид «Радио»",
  "radio.player.radioView.meta": "Каналы и большие кнопки",
  "radio.player.photo.a11y": "Картинка к этой записи",

  "playback.speed.title": "Скорость",
  "playback.speed.meta": "От 0,5× до 2×",
  "playback.speed.slower": "Медленнее",
  "playback.speed.faster": "Быстрее",
  "playback.speed.reset": "Обычная скорость",
  "playback.speed.keepPitch": "Сохранять высоту голоса",
  "playback.speed.keepPitch.sub": "Голос не становится выше или ниже при смене скорости",
  "playback.speed.pitchNote":
    "Если выключить, высота будет меняться вместе со скоростью. Это работает только на iPhone и начнётся со следующей записи. Шаги в полутон требуют другого звукового движка.",
  "playback.speed.remember": "Запомнить для этой записи",
  "playback.speed.remember.sub": "В следующий раз она начнётся с этой скоростью",
  "playback.speed.default": "Для всех записей",
  "playback.speed.default.sub": "Сейчас: {rate}",

  "playback.sleep.title": "Таймер сна",
  "playback.sleep.min": "{minutes} мин",
  "playback.sleep.endTrack": "До конца этой записи",
  "playback.sleep.endList": "До конца плейлиста",
  "playback.sleep.off": "Отменить таймер",
  "playback.sleep.left": "Осталось {time}",
  "playback.sleep.note": "В конце звук плавно затихает. Таймер работает и при выключенном экране.",
  "playback.sleep.chip": "Сон {time}",
  "playback.sleep.chip.a11y": "Таймер сна, осталось {time}. Нажмите, чтобы отменить",
  "player.sleep.endOfList": "Конец плейлиста",
  "player.sleep.toastEndList": "Таймер сна: до конца плейлиста",

  "profile.transitions": "Плавные переходы",
  "transitions.sheet.a11y": "Плавные переходы",
  "transitions.title": "Плавные переходы",
  "transitions.intro":
    "В конце записи звук плавно затихает, а следующая запись плавно нарастает. Это звучит как радиостанция, а не как резкий обрыв.",
  "transitions.radio": "В радио",
  "transitions.radio.sub": "По умолчанию включено",
  "transitions.list": "В плейлистах и очереди",
  "transitions.list.sub": "По умолчанию выключено",
  "transitions.off": "Выкл.",
  "transitions.seconds": "{seconds} с",
  "transitions.less": "Короче",
  "transitions.more": "Дольше",
  "transitions.note.engine":
    "Две записи не звучат одновременно: одна затихает, потом нарастает следующая. Настоящее наложение требует второго аудиоплеера, пока его нет.",
  "transitions.note.web": "В предпросмотре в браузере нет звука, поэтому это слышно только на телефоне.",

  "player.continue.from": "Продолжить с {time}",
} as const
