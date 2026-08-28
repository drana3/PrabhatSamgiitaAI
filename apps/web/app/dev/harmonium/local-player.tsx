"use client"

import { useState } from "react"

import { VirtualHarmonium } from "@/components/virtual-harmonium"

export function LocalHarmoniumPlayer() {
  const [tonic, setTonic] = useState("C")
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <p className="eyebrow">Local only</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-navy-950 sm:text-5xl">Harmonium player</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
        Real Yale Euterpea reeds via Tone.js. Hold keys, try chords, drone, and Play on keys. Nothing is deployed until you say so.
      </p>
      <div className="mt-8 max-w-5xl">
        <VirtualHarmonium tonic={tonic} onTonicChange={setTonic} />
      </div>
    </div>
  )
}
