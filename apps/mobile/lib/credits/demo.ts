import { RemoteError } from "@/lib/kirtan/remote"
import type { CreditRole, CreditView, InviteView } from "@/lib/kirtan/credits"
import type { BlockedPerson, CreditList, CreditOut, CreditsApi, InviteLinkOut, MyCredit } from "@/lib/credits/remote"

/**
 * The credits API of the web preview (MOCKUP_DATA): invented people, nothing is sent anywhere. It keeps its state for the
 * run, so the preview can add a person, answer an invitation, leave a credit and see the lists change.
 */
export function createDemoCreditsApi(): CreditsApi {
  let invites: InviteView[] = [
    {
      credit_id: "demo-invite-1",
      recording: { id: "demo-rec-1", kind: "kiirtan", title: "Baba Nam Kevalam, evening", author: "Priya Devi & You" },
      from_name: "Priya Devi",
      role: "performer",
      created_at: "2026-11-16T09:00:00Z",
      expires_at: "2026-12-16T09:00:00Z",
    },
  ]
  let mine: MyCredit[] = [{ credit_id: "demo-credit-1", recording: { id: "demo-rec-2", kind: "bhajan", title: "Ananda Murti Jaya", author: "Arun Deva & You" }, role: "author", shown: true }]
  let blocks: BlockedPerson[] = []
  let invitesSetting: "everyone" | "nobody" = "everyone"
  const people = new Map<string, CreditView[]>([
    [
      "demo-rec-3",
      [
        { id: "c1", name: "You", role: "performer", status: "accepted", page: { slug: "demo-you", display_name: "You" } },
        { id: "c2", name: "Arun Deva", role: "performer", status: "invited", page: null },
        { id: "c3", name: "Someone Far Away", role: "author", status: "text", page: null },
      ],
    ],
  ])

  const out = (c: CreditView): CreditOut => c
  const listOf = (recordingId: string): CreditList => {
    const credits = people.get(recordingId) ?? []
    return { credits, can_manage: true, summary: { confirmed: credits.filter((c) => c.status === "accepted").length, waiting: credits.filter((c) => c.status === "invited").length } }
  }
  const find = (creditId: string): CreditView | undefined => [...people.values()].flat().find((c) => c.id === creditId)

  return {
    demo: true,
    list: async (recordingId) => listOf(recordingId),
    add: async (recordingId, person) => {
      const credits = people.get(recordingId) ?? []
      if (credits.length >= 10) throw new RemoteError(422, "Too many", { code: "too_many" })
      credits.push({ id: `c${Date.now()}`, name: person.name, role: person.role, status: person.profile_id ? "invited" : "text", page: null })
      people.set(recordingId, credits)
      return listOf(recordingId)
    },
    remove: async (recordingId, creditId) => {
      people.set(recordingId, (people.get(recordingId) ?? []).filter((c) => c.id !== creditId))
    },
    setRole: async (_recordingId, creditId, role: CreditRole) => {
      const found = find(creditId)
      if (!found) throw new RemoteError(404, "Not found", { code: "credit_not_found" })
      found.role = role
      return out(found)
    },
    link: async (): Promise<InviteLinkOut> => ({ token: "demo-token-demo-token-demo-token-1234", expires_at: "2027-01-16T09:00:00Z" }),
    invites: async () => invites,
    accept: async (creditId) => {
      invites = invites.filter((i) => i.credit_id !== creditId)
      return { id: creditId, name: "You", role: "performer", status: "accepted", page: null }
    },
    decline: async (creditId, block) => {
      const gone = invites.find((i) => i.credit_id === creditId)
      invites = invites.filter((i) => i.credit_id !== creditId)
      if (block && gone) blocks = [...blocks, { id: `b-${creditId}`, name: gone.from_name }]
      return { id: creditId, name: "You", role: "performer", status: "declined", page: null }
    },
    mine: async () => mine,
    leave: async (creditId) => {
      mine = mine.filter((c) => c.credit_id !== creditId)
      return { id: creditId, name: "You", role: "performer", status: "removed", page: null }
    },
    setMyRole: async (creditId, role) => {
      mine = mine.map((c) => (c.credit_id === creditId ? { ...c, role } : c))
      return { id: creditId, name: "You", role, status: "accepted", page: null }
    },
    acceptLink: async () => ({ id: "demo-link", name: "You", role: "performer", status: "accepted", page: null }),
    settings: async () => ({ credit_invites: invitesSetting }),
    setSettings: async (value) => {
      invitesSetting = value
      return { credit_invites: value }
    },
    blocks: async () => blocks,
    unblock: async (id) => {
      blocks = blocks.filter((b) => b.id !== id)
    },
  }
}
