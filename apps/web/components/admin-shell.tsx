import Link from "next/link"
import type { ReactNode } from "react"

import { AdminNav, type AdminSection } from "@/components/admin-nav"

type AdminShellProps = {
  active: AdminSection
  title: string
  description?: string
  children: ReactNode
  maxWidth?: "3xl" | "5xl"
}

export function AdminShell({
  active,
  title,
  description,
  children,
  maxWidth = "5xl",
}: AdminShellProps) {
  const widthClass = maxWidth === "3xl" ? "max-w-3xl" : "max-w-5xl"

  return (
    <main className="min-h-screen bg-ivory-50">
      <header className="border-b border-navy-900/10 bg-white">
        <div className={`mx-auto ${widthClass} px-4 sm:px-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Admin console</p>
              <h1 className="font-serif text-3xl text-navy-950">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{description}</p>
              ) : null}
            </div>
            <Link href="/" className="outline-button shrink-0 px-4 py-2.5 text-sm">
              Back to site
            </Link>
          </div>
          <AdminNav active={active} />
        </div>
      </header>

      <div className={`mx-auto ${widthClass} px-4 py-6 sm:px-6`}>{children}</div>
    </main>
  )
}
