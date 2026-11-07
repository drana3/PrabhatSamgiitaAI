/** Whether the preview pretends nobody is signed in (set by DemoControl.setSignedIn). No imports: the demo and its tests load it. */
let signedOut = false
export const setDemoSignedOut = (value: boolean): void => {
  signedOut = value
}
export const demoSignedOut = (): boolean => signedOut
