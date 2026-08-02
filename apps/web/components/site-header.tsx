import Image from "next/image"
import Link from "next/link"
import { CommunityFeedbackTicker } from "@/components/community-feedback-ticker"
import { MemberMenu } from "@/components/member-menu"

const navigation = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/stories", label: "Stories" },
  { href: "/quiz", label: "Quiz" },
  { href: "/#today", label: "Today" },
  { href: "/#about", label: "About" },
]

export function SiteHeader({ active = "Home" }: { active?: string }) {
  return (
    <div className="sticky top-0 z-50">
      <CommunityFeedbackTicker />
      <header className="border-b border-navy-900/10 bg-ivory-50/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[5.25rem] max-w-[90rem] items-center justify-between gap-5 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Prabhat Samgiita home" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <Image
            src="/brand/prabhat-samgiita-emblem.png"
            alt="Prabhat Samgiita"
            width={680}
            height={680}
            className="h-[3.6rem] w-[3.6rem] object-contain sm:h-[4.15rem] sm:w-[4.15rem]"
            priority
          />
          <span className="hidden font-serif text-[1.05rem] leading-[1.05] tracking-[0.06em] text-navy-950 min-[390px]:block sm:text-xl">
            <span className="block">PRABHAT</span>
            <span className="block">SAMGIITA</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex lg:gap-8">
          {navigation.map((item) => item.href.includes("#") ? (
            <a key={item.label} href={item.href} className={`nav-link ${active === item.label ? "nav-link-active" : ""}`}>{item.label}</a>
          ) : (
            <Link key={item.label} href={item.href} className={`nav-link ${active === item.label ? "nav-link-active" : ""}`}>{item.label}</Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/#about" className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold text-navy-950 md:hidden">About</Link>
          <Link href="/explore" data-feature="listen_now" className="gold-button shrink-0 whitespace-nowrap px-4 py-2.5 sm:px-5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-600 text-xs text-white">▶</span>
            <span className="hidden sm:inline">Listen now</span>
          </Link>
          <MemberMenu />
        </div>
        </div>
      </header>
    </div>
  )
}
