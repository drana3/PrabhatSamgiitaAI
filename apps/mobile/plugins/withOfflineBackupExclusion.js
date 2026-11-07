/**
 * Keeps the downloaded songs (Documents/offline-audio on iOS, files/offline-audio on Android) out of backups.
 * They can be downloaded again, so Apple asks that they are not backed up (Data Storage guideline), and on Android
 * a backup over the 25 MB Auto Backup quota fails as a whole, which would also lose the small things worth keeping.
 *
 * iOS: expo-file-system has no API for NSURLIsExcludedFromBackupKey, so the AppDelegate sets it on the folder at
 *      launch (a directory flagged this way excludes everything in it, also the files saved later).
 * Android: backup rules (fullBackupContent for Android 11 and older, dataExtractionRules for 12 and newer).
 */
const fs = require("fs")
const path = require("path")
const { withAppDelegate, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins")

const FOLDER = "offline-audio"
const IOS_MARKER = "// offline-audio backup exclusion"
const SUPER_CALL = "return super.application(application, didFinishLaunchingWithOptions: launchOptions)"

const IOS_SNIPPET = `    ${IOS_MARKER}
    if let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      var offlineAudio = documents.appendingPathComponent("${FOLDER}", isDirectory: true)
      try? FileManager.default.createDirectory(at: offlineAudio, withIntermediateDirectories: true)
      var excluded = URLResourceValues()
      excluded.isExcludedFromBackup = true
      try? offlineAudio.setResourceValues(excluded)
    }
`

/** Puts the snippet in front of the `super.application(...)` return of a Swift AppDelegate. Idempotent. */
function injectIosBackupExclusion(contents) {
  if (contents.includes(IOS_MARKER)) return contents
  const at = contents.indexOf(SUPER_CALL)
  if (at < 0) return null
  const lineStart = contents.lastIndexOf("\n", at) + 1
  return `${contents.slice(0, lineStart)}${IOS_SNIPPET}${contents.slice(lineStart)}`
}

const FULL_BACKUP_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="file" path="${FOLDER}" />
</full-backup-content>
`

const DATA_EXTRACTION_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="file" path="${FOLDER}" />
  </cloud-backup>
  <device-transfer>
    <exclude domain="file" path="${FOLDER}" />
  </device-transfer>
</data-extraction-rules>
`

const FULL_BACKUP_NAME = "offline_backup_rules"
const DATA_EXTRACTION_NAME = "offline_data_extraction_rules"

function withIosExclusion(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift") {
      console.warn("[withOfflineBackupExclusion] AppDelegate is not Swift: offline-audio is not excluded from iCloud backup.")
      return mod
    }
    const next = injectIosBackupExclusion(mod.modResults.contents)
    if (next === null) {
      console.warn("[withOfflineBackupExclusion] AppDelegate has no super.application call: offline-audio is not excluded from iCloud backup.")
      return mod
    }
    mod.modResults.contents = next
    return mod
  })
}

function withAndroidExclusion(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (application) {
      application.$["android:fullBackupContent"] = `@xml/${FULL_BACKUP_NAME}`
      application.$["android:dataExtractionRules"] = `@xml/${DATA_EXTRACTION_NAME}`
    }
    return mod
  })
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml")
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${FULL_BACKUP_NAME}.xml`), FULL_BACKUP_XML)
      fs.writeFileSync(path.join(dir, `${DATA_EXTRACTION_NAME}.xml`), DATA_EXTRACTION_XML)
      return mod
    },
  ])
}

function withOfflineBackupExclusion(config) {
  return withAndroidExclusion(withIosExclusion(config))
}

module.exports = withOfflineBackupExclusion
module.exports.injectIosBackupExclusion = injectIosBackupExclusion
module.exports.FULL_BACKUP_XML = FULL_BACKUP_XML
module.exports.DATA_EXTRACTION_XML = DATA_EXTRACTION_XML
