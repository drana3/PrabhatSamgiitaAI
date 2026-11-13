/**
 * How the upload screens are left once something went up. The stack is: the tab shell, then (often) the Upload hub,
 * then the form with its result. Going BACK or REPLACING the form left the hub standing under the result. These plans
 * close every page above the shell instead, so "Done" lands on the tab the person came from, and a page opened after
 * the upload (a playlist) sits straight on the shell. Pure and tested (__tests__/uploadExit.test.ts); the hook that runs
 * a plan is components/kirtan/useUploadExit.ts.
 */

export type ExitStep = { op: "dismissAll" } | { op: "dismissTo" | "push" | "replace"; href: string }

/** Where the person goes when nothing else is asked and no tab is known (a link opened the form straight away). */
export const UPLOAD_FALLBACK_HREF = "/v2/kiirtan"

/** The list of Kiirtans the person sent. */
export const MY_UPLOADS_HREF = "/v2/kiirtan?filter=mine"

/** "Done": close the pages above the shell, so the tab the person came from shows. With no shell below, open the Kiirtan tab. */
export function exitToOrigin(canDismiss: boolean): ExitStep[] {
  return canDismiss ? [{ op: "dismissAll" }] : [{ op: "replace", href: UPLOAD_FALLBACK_HREF }]
}

/** A tab of the shell (the list of my uploads): the pages above the shell close and the tab is selected, in one step. */
export function exitToTab(tabHref: string, canDismiss: boolean): ExitStep[] {
  return canDismiss ? [{ op: "dismissTo", href: tabHref }] : [{ op: "replace", href: tabHref }]
}

/** A page of its own (a playlist): the upload pages close, then the page opens straight on the shell, so Back leads to the tab. */
export function exitToPage(pageHref: string, canDismiss: boolean): ExitStep[] {
  return canDismiss ? [{ op: "dismissAll" }, { op: "push", href: pageHref }] : [{ op: "replace", href: pageHref }]
}

/** Runs a plan on a router. */
export function runExit(router: { dismissAll: () => void; dismissTo: (href: never) => void; push: (href: never) => void; replace: (href: never) => void }, steps: readonly ExitStep[], toHref: (value: string) => never): void {
  for (const step of steps) {
    if (step.op === "dismissAll") router.dismissAll()
    else router[step.op](toHref(step.href))
  }
}
