import type { ActiveSiteAnnouncement } from "@prabhat/core"

export type { ActiveSiteAnnouncement } from "@prabhat/core"

export type AdminSiteAnnouncement = ActiveSiteAnnouncement & {
  starts_at: string
  is_active: boolean
  notify_by_email: boolean
  email_sent_count: number
  created_at: string
}
