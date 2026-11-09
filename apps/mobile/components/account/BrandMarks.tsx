import { Platform } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"

/** Marks are decoration: the button's label names the action. (The web build rejects the native props.) */
const HIDDEN = (Platform.OS === "web" ? { "aria-hidden": true } : { accessibilityElementsHidden: true, importantForAccessibility: "no" as const }) as object

/** The provider marks on the sign-in buttons, in the providers' own colours. 24 x 24 viewBox. */
export function AppleMark({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      <Path
        fill={color}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  )
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      <Path
        fill="#4285F4"
        d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.64h6.456a5.52 5.52 0 0 1-2.395 3.622v3.01h3.878c2.269-2.088 3.581-5.165 3.581-8.817z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.956-1.075 7.942-2.909l-3.878-3.01c-1.075.72-2.45 1.145-4.064 1.145-3.126 0-5.773-2.111-6.717-4.95H1.276v3.109A11.997 11.997 0 0 0 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.283 14.276A7.213 7.213 0 0 1 4.909 12c0-.79.136-1.558.374-2.276V6.615H1.276A11.997 11.997 0 0 0 0 12c0 1.936.464 3.769 1.276 5.385l4.007-3.109z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.773c1.763 0 3.345.606 4.59 1.795l3.442-3.442C17.951 1.19 15.236 0 12 0 7.31 0 3.255 2.69 1.276 6.615l4.007 3.109C6.227 6.884 8.874 4.773 12 4.773z"
      />
    </Svg>
  )
}

export function MicrosoftMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      <Rect x={1} y={1} width={10.5} height={10.5} fill="#F25022" />
      <Rect x={12.5} y={1} width={10.5} height={10.5} fill="#7FBA00" />
      <Rect x={1} y={12.5} width={10.5} height={10.5} fill="#00A4EF" />
      <Rect x={12.5} y={12.5} width={10.5} height={10.5} fill="#FFB900" />
    </Svg>
  )
}
