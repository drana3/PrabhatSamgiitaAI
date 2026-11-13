/**
 * `behavior` for every KeyboardAvoidingView in the app.
 *
 * iOS: padding. Android: padding too. Since Expo SDK 54 the app is edge to edge on Android, and then the system no
 * longer shrinks the window when the keyboard opens (adjustResize only delivers insets), so a view that does not
 * move itself leaves the field under the keyboard. `undefined` was the old Android value and is wrong here; `height`
 * works but depends on the first measured height and jumps. Web has no on-screen keyboard to avoid.
 */
export type KeyboardAvoidingBehavior = "padding" | "height" | "position" | undefined

export function keyboardBehavior(os: string): KeyboardAvoidingBehavior {
  return os === "web" ? undefined : "padding"
}
