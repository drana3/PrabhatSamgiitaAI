import Image from "next/image"

import { mobileStoreLinks, mobileStoreQrUrl, type MobileStoreLink } from "@/lib/mobile-stores"

const STORE_COLUMN_WIDTH = "w-[7.5rem]"
const STORE_BADGE_BOX = "h-10 w-[7.5rem]"

function StoreDownloadColumn(store: MobileStoreLink) {
  const qrSrc = mobileStoreQrUrl(store.platform, 96)

  return (
    <div className={`flex ${STORE_COLUMN_WIDTH} flex-col items-center gap-1.5`}>
      <Image
        src={qrSrc}
        alt={`${store.qrLabel} — ${store.shortLabel}`}
        width={96}
        height={96}
        unoptimized
        title={store.qrLabel}
        className="h-11 w-11 shrink-0 rounded-md border border-navy-900/8 bg-white p-0.5 sm:h-12 sm:w-12"
      />
      <a
        href={store.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={store.label}
        className={`flex ${STORE_BADGE_BOX} items-center justify-center transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500`}
      >
        <Image
          src={store.badgeSrc}
          alt=""
          width={store.badgeWidth}
          height={store.badgeHeight}
          className={`${STORE_BADGE_BOX} object-contain object-center ${store.platform === "android" ? "rounded-[8px]" : ""}`}
        />
      </a>
    </div>
  )
}

export function MobileAppHeroStrip() {
  const stores = mobileStoreLinks()

  return (
    <section
      id="mobile-app"
      aria-label="Download Prabhat Samgiita AI"
      className="mt-6 max-w-xl scroll-mt-28 rounded-[1.35rem] border border-gold-500/25 bg-white/80 p-4 shadow-[0_14px_34px_rgba(42,31,15,0.1)] backdrop-blur-sm sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Image
            src="/brand/app-icon-192.png"
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 rounded-[0.85rem] border border-white/90 shadow-[0_8px_18px_rgba(42,31,15,0.12)]"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-950">Best on phone or tablet</p>
            <p className="mt-0.5 text-sm font-semibold text-navy-900">Prabhat Samgiita AI</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Offline listening, saved songs, and the AI Companion — download the app.
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:gap-4" aria-label="Scan or download the app">
          {stores.map((store) => (
            <StoreDownloadColumn key={store.platform} {...store} />
          ))}
        </div>
      </div>
    </section>
  )
}
