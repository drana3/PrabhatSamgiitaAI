/**
 * Loading this file wires every store that holds one account's data to the signed-in person
 * (lib/account/owner.ts). The root layout loads it through MemberSessionSync, so it is in place before any
 * screen reads those stores. Each store binds itself when its module loads; this file only makes sure they all load.
 */
import { reconcileKirtanOwner } from "@/stores/kirtanOwnerStore"
import { reconcileLearnOwner } from "@/stores/learnStore"
import { reconcilePreferencesOwner } from "@/stores/preferencesStore"
import { reconcileResumeOwner } from "@/stores/resumeStore"
import "@/stores/playlistStore"

/** Run every binder again (after a restore, and in tests). */
export function reconcileAllOwners() {
  reconcileKirtanOwner()
  reconcileLearnOwner()
  reconcilePreferencesOwner()
  reconcileResumeOwner()
}
