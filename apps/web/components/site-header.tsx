import Image from "next/image"
import Link from "next/link"

const navigation = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/#today", label: "Today" },
  { href: "/#about", label: "About" },
]

export function SiteHeader({ active = "Home" }: { active?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-ivory-50/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.75rem] max-w-[90rem] items-center justify-between gap-5 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Prabhat Samgiita home" className="shrink-0">
          <Image
            src="/brand/prabhat-samgiita-lockup.png"
            alt="Prabhat Samgiita"
            width={216}
            height={110}
            className="h-12 w-[9.5rem] object-contain object-left sm:w-[11rem]"
            priority
          />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-link ${active === item.label ? "nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/explore" data-feature="listen_now" className="gold-button px-4 py-2.5 sm:px-5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-600 text-xs text-white">▶</span>
          <span className="hidden sm:inline">Listen now</span>
        </Link>
      </div>
    </header>
  )
}
