/**
 * Strings of the share card sheet (components/share/ShareCardSheet.tsx) and its entry in the share sheets.
 * English is the source and the fallback; ru and es mirror it key for key. Kept in its own file so it does not
 * collide with the main dictionaries while those are being edited; it can be spread into them later.
 */
export const shareCardEn = {
  "shareCard.entry": "Image card",
  "shareCard.title": "Share card",
  "shareCard.close": "Close",
  "shareCard.shape": "Card shape",
  "shareCard.portrait": "Portrait",
  "shareCard.square": "Square",
  "shareCard.share": "Share image",
  "shareCard.save": "Save image",
  "shareCard.copy": "Copy link",
  "shareCard.preparing": "Preparing the picture...",
  "shareCard.hintNative": "The share sheet takes the picture. Save Image and Instagram are in it.",
  "shareCard.hintWeb": "Save the picture, or copy the link to send it.",
  "shareCard.failed": "The picture could not be made. Try again.",
  "shareCard.saved": "Image saved",
  "shareCard.copied": "Link copied",
  "shareCard.copyFailed": "Could not copy the link",
  "shareCard.unsupported": "This browser cannot share a picture. Use Save image.",
}

export const shareCardRu: Record<keyof typeof shareCardEn, string> = {
  "shareCard.entry": "Картинка",
  "shareCard.title": "Открытка",
  "shareCard.close": "Закрыть",
  "shareCard.shape": "Форма открытки",
  "shareCard.portrait": "Вертикальная",
  "shareCard.square": "Квадрат",
  "shareCard.share": "Поделиться картинкой",
  "shareCard.save": "Сохранить картинку",
  "shareCard.copy": "Скопировать ссылку",
  "shareCard.preparing": "Готовим картинку...",
  "shareCard.hintNative": "Картинку принимает меню «Поделиться». В нём есть «Сохранить изображение» и Instagram.",
  "shareCard.hintWeb": "Сохраните картинку или скопируйте ссылку, чтобы отправить.",
  "shareCard.failed": "Не удалось сделать картинку. Попробуйте ещё раз.",
  "shareCard.saved": "Картинка сохранена",
  "shareCard.copied": "Ссылка скопирована",
  "shareCard.copyFailed": "Не удалось скопировать ссылку",
  "shareCard.unsupported": "Этот браузер не умеет делиться картинкой. Нажмите «Сохранить картинку».",
}

export const shareCardEs: Record<keyof typeof shareCardEn, string> = {
  "shareCard.entry": "Imagen",
  "shareCard.title": "Tarjeta",
  "shareCard.close": "Cerrar",
  "shareCard.shape": "Formato de la tarjeta",
  "shareCard.portrait": "Vertical",
  "shareCard.square": "Cuadrado",
  "shareCard.share": "Compartir imagen",
  "shareCard.save": "Guardar imagen",
  "shareCard.copy": "Copiar enlace",
  "shareCard.preparing": "Preparando la imagen...",
  "shareCard.hintNative": "El menú de compartir recibe la imagen. Ahí están Guardar imagen e Instagram.",
  "shareCard.hintWeb": "Guarda la imagen o copia el enlace para enviarlo.",
  "shareCard.failed": "No se pudo crear la imagen. Inténtalo de nuevo.",
  "shareCard.saved": "Imagen guardada",
  "shareCard.copied": "Enlace copiado",
  "shareCard.copyFailed": "No se pudo copiar el enlace",
  "shareCard.unsupported": "Este navegador no puede compartir una imagen. Usa Guardar imagen.",
}
