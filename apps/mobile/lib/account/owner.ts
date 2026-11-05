/**
 * Whose data is on this phone. Some stores keep things that belong to one account (learning progress, saved
 * Kiirtans, recent songs, notes). The phone can be shared and people sign out and in, so every such store
 * stamps its data with an owner and swaps it when the owner changes:
 *
 *   guest ──signs in──> member A     the guest's data moves into A (nobody else claimed it)
 *   member A ──signs out──> guest    A's data is put aside under A; the guest's own data comes back (empty by now)
 *   guest ──signs in──> member B     B sees only B's data, never A's
 *   member A ──> member B directly   A's data is put aside, B's comes in
 *
 * "Put aside" means kept in `slots[owner]` of the same store: hidden from everyone but that account, back when
 * that account signs in again. Account deletion removes the slot. Pure functions, no stores here.
 */

export type OwnerAuth = {
  mode: "guest" | "signed_in"
  memberId: string | null
  email: string | null
}

export const GUEST_OWNER = "guest"

/** "guest" for a guest, `member:<id>` for a signed-in account (the account id, else the email). */
export function ownerKeyOf(auth: OwnerAuth): string {
  if (auth.mode !== "signed_in") return GUEST_OWNER
  const id = (auth.memberId || "").trim() || (auth.email || "").trim().toLowerCase()
  return `member:${id}`
}

export type OwnedData<T> = {
  /** whose data `data` is; null for data saved by a build that did not stamp it */
  owner: string | null
  /** data of the accounts that are not in use now */
  slots: Record<string, T>
}

export type Rotation<T> = { owner: string; slots: Record<string, T>; data: T }

/**
 * The owner changed (or the app just started): returns who owns what now.
 * `snapshot` is what the store holds, `empty` what a new owner starts with.
 */
export function rotateOwner<T>(held: OwnedData<T>, snapshot: T, next: string, empty: T): Rotation<T> {
  const slots = { ...held.slots }
  const previous = held.owner
  if (previous === next) {
    return { owner: next, slots, data: snapshot }
  }
  // Saved before owners were stamped: it is most likely the person using the phone now.
  if (previous === null) {
    delete slots[next]
    return { owner: next, slots, data: snapshot }
  }
  // A guest signing in brings what they did as a guest, unless that account already has its own data.
  if (previous === GUEST_OWNER && next !== GUEST_OWNER && !(next in slots)) {
    slots[GUEST_OWNER] = empty
    return { owner: next, slots, data: snapshot }
  }
  slots[previous] = snapshot
  const data = next in slots ? (slots[next] as T) : empty
  delete slots[next]
  return { owner: next, slots, data }
}

/** Forget an account's put-aside data (account deletion). */
export function dropSlot<T>(slots: Record<string, T>, owner: string): Record<string, T> {
  const { [owner]: _gone, ...rest } = slots
  return rest
}
