/**
 * Strings of the profile photo crop sheet (components/profile-v2/PhotoCropSheet.tsx). English is the
 * source and the fallback; ru and es mirror it key for key. Kept in its own file so it does not collide with
 * the main dictionaries while those are being edited; it can be spread into them later.
 */
export const photoCropEn = {
  "photoCrop.title": "Position your photo",
  "photoCrop.hint": "Drag to move. Pinch or scroll to zoom.",
  "photoCrop.area": "Photo position. Drag to move the picture, pinch or scroll to zoom.",
  "photoCrop.zoomIn": "Zoom in",
  "photoCrop.zoomOut": "Zoom out",
  "photoCrop.reset": "Reset",
  "photoCrop.done": "Done",
  "photoCrop.cancel": "Cancel",
  "photoCrop.failed": "That picture could not be cropped. Try another one.",
} as const

export const photoCropRu: Record<keyof typeof photoCropEn, string> = {
  "photoCrop.title": "Расположите фото",
  "photoCrop.hint": "Перетащите, чтобы сдвинуть. Сведите пальцы или прокрутите, чтобы изменить масштаб.",
  "photoCrop.area": "Положение фото. Перетащите, чтобы сдвинуть картинку, сведите пальцы или прокрутите, чтобы изменить масштаб.",
  "photoCrop.zoomIn": "Приблизить",
  "photoCrop.zoomOut": "Отдалить",
  "photoCrop.reset": "Сбросить",
  "photoCrop.done": "Готово",
  "photoCrop.cancel": "Отмена",
  "photoCrop.failed": "Не удалось обрезать эту картинку. Попробуйте другую.",
}

export const photoCropEs: Record<keyof typeof photoCropEn, string> = {
  "photoCrop.title": "Coloca tu foto",
  "photoCrop.hint": "Arrastra para mover. Pellizca o desplaza para acercar.",
  "photoCrop.area": "Posición de la foto. Arrastra para mover la imagen; pellizca o desplaza para acercar.",
  "photoCrop.zoomIn": "Acercar",
  "photoCrop.zoomOut": "Alejar",
  "photoCrop.reset": "Restablecer",
  "photoCrop.done": "Hecho",
  "photoCrop.cancel": "Cancelar",
  "photoCrop.failed": "No se pudo recortar esa imagen. Prueba con otra.",
}
