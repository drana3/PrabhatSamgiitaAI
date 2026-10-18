"use client"

import Link from "next/link"

import { QuizBoard } from "@/components/quiz-board"
import { SiteHeader } from "@/components/site-header"

export default function QuizPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Quiz" />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-gold-700">← Back to home</Link>
        <p className="eyebrow mt-6">Learn &amp; certify</p>
        <h1 className="mt-2 font-serif text-4xl text-navy-950 sm:text-5xl">Prabhat Samgiita quiz</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Test your knowledge at Starter, Intermediate, or Experienced level. Every attempt uses 10 fresh random questions.
        </p>
        <div className="mt-8">
          <QuizBoard />
        </div>
      </section>
    </main>
  )
}
