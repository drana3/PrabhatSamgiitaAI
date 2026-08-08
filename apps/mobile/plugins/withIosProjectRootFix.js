const fs = require("fs")
const path = require("path")
const { withPodfile, withDangerousMod } = require("@expo/config-plugins")

const MARKER = "EXConstants PROJECT_ROOT fix"
const RN_MARKER = "RN_XCODE_SCRIPT"

function patchPbxproj(pbxprojPath) {
  if (!fs.existsSync(pbxprojPath)) return
  let pbx = fs.readFileSync(pbxprojPath, "utf8")
  if (pbx.includes(RN_MARKER)) return

  pbx = pbx.replace(
    'export PROJECT_ROOT=\\"$PROJECT_DIR\\"/..',
    'export PROJECT_ROOT=\\"$(cd \\"$PROJECT_DIR/..\\" && pwd -P)\\"',
  )
  pbx = pbx.replace(
    '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`\\n\\n";',
    `${RN_MARKER}=\\"$(\\"$NODE_BINARY\\" --print \\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\")\\"\\n/bin/bash \\"$${RN_MARKER}\\"\\n\\n";`,
  )
  fs.writeFileSync(pbxprojPath, pbx)
}

function withIosProjectRootFix(config) {
  config = withPodfile(config, (podfile) => {
    if (podfile.modResults.contents.includes(MARKER)) {
      return podfile
    }

    const injection = `
    # ${MARKER} — paths with spaces break Expo's get-app-config-ios.sh.
    project_root = File.expand_path('..', Pod::Config.instance.installation_root)
    installer.pods_project.targets.each do |target|
      next unless target.name == 'EXConstants'
      target.shell_script_build_phases.each do |phase|
        next unless phase.name&.include?('Generate app.config')
        phase.shell_script = <<~SCRIPT
          set -eo pipefail
          export PROJECT_ROOT="\#{project_root}"
          DEST="$CONFIGURATION_BUILD_DIR"
          RESOURCE_BUNDLE_NAME="EXConstants.bundle"
          if [ "$BUNDLE_FORMAT" = "deep" ]; then
            RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME/Contents/Resources"
          else
            RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"
          fi
          mkdir -p "$RESOURCE_DEST"
          /bin/bash "$PODS_TARGET_SRCROOT/../scripts/with-node.sh" \\\\
            "$PODS_TARGET_SRCROOT/../scripts/getAppConfig.js" \\\\
            "$PROJECT_ROOT" \\\\
            "$RESOURCE_DEST"
        SCRIPT
      end
    end
`

    podfile.modResults.contents = podfile.modResults.contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|${injection}`,
    )

    return podfile
  })

  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot
      const entries = fs.readdirSync(iosRoot).filter((name) => name.endsWith(".xcodeproj"))
      for (const entry of entries) {
        patchPbxproj(path.join(iosRoot, entry, "project.pbxproj"))
      }
      return config
    },
  ])
}

module.exports = withIosProjectRootFix
