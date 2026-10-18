import Link from "next/link"

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 text-center"><div className="max-w-lg"><p className="eyebrow">A quiet pause</p><h1 className="mt-4 font-serif text-5xl text-navy-950">This song or page was not found</h1><p className="mt-4 leading-7 text-stone-600">Prabhat Samgiita song numbers run from 1 to 5,018. Search by number, opening words, meaning, or feeling.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/explore" className="gold-button px-6 py-3">Explore songs</Link><Link href="/" className="outline-button">Return home</Link></div></div></main>
}
