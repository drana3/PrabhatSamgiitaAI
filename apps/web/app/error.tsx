"use client"

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 text-center"><div className="max-w-lg"><p className="eyebrow">The music is still here</p><h1 className="mt-4 font-serif text-5xl text-navy-950">This page needs another moment</h1><p className="mt-4 leading-7 text-stone-600">A connection or service was interrupted. Your request was not lost, and you can safely try again.</p><button type="button" onClick={reset} className="gold-button mt-7 px-6 py-3">Try again</button></div></main>
}
