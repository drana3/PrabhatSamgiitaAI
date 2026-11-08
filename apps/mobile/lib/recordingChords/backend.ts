import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewName } from "@/lib/songComments/backend"

import { recordingHasCharts } from "./kinds"
import { createSheetsMock, sheetMockFailure } from "./mock"
import { sheetFailureFromError, sheetsRemote } from "./remote"
import type { SheetFailure, SheetsBackend } from "./types"

/** Which server the chord sheets talk to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: SheetsBackend | null = null

export function sheetsBackend(): SheetsBackend {
  if (MOCKUP_DATA) {
    mock ??= createSheetsMock({ me: previewName, chartKind: recordingHasCharts })
    return mock
  }
  return sheetsRemote(remoteConfig())
}

/** Any error of either backend as a failure the screens have a sentence for. */
export function sheetFailure(error: unknown): SheetFailure {
  return sheetMockFailure(error) ?? sheetFailureFromError(error)
}
