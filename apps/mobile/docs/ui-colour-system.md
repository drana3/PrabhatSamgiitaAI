
## Outlines and tracks

`line` divides rows (white 9 percent in Dark, 1.26:1): never use it as the outline of a field, a button, an empty tick or radio circle, or the off track of a switch. Use `controlBorder(theme)` and `switchTrackOff(theme)` from `lib/controlColors.ts`: they give `lineStrong` and `trackOff` in Dark (3.3:1 and 3.7:1) and keep `line` in Light. Behind a bottom sheet use `amSheetScrim` (black; 0.4 in Light, 0.6 in Dark), never the heading colour. Text on a photo sits on `amScrimPhoto` (the top date of the Today card too). The web shell (`app/+html.tsx`) and the splash (`app.json`, `splash.dark`) carry the page ground so there is no white flash.
