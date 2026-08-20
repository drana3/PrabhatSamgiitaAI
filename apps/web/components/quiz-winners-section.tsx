"use client"

import { useEffect, useState } from "react"

import { fetchQuizWinners, readCachedQuizWinners, type QuizWinnersGroup } from "@/lib/quiz-events"

export function QuizWinnersSection() {
  const [groups, setGroups] = useState<QuizWinnersGroup[]>(() => readCachedQuizWinners())

  useEffect(() => {
    void fetchQuizWinners().then(setGroups)
  }, [])

  if (!groups.length) return null

  return (
    <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
      <div className="rounded-[2rem] border border-navy-900/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="eyebrow">Community quiz</p>
        <h2 className="mt-3 font-serif text-3xl text-navy-950 sm:text-4xl">
          Recent Prabhat Samgiita Quiz winners
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Top performers from the latest verified live quizzes.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {groups.map((group) => (
            <article key={group.event.id} className="rounded-2xl border border-navy-900/10 bg-ivory-50/70 p-5">
              <h3 className="font-serif text-xl text-navy-950">{group.event.title}</h3>
              <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                {new Date(group.event.deadline).toLocaleDateString()}
              </p>
              <ol className="mt-4 space-y-3">
                {group.winners.map((winner) => (
                  <li key={`${group.event.id}-${winner.rank}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-navy-950">
                        #{winner.rank} {winner.display_name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {winner.score}/{winner.total} correct
                      </p>
                    </div>
                    <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-900">
                      Top {winner.rank}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
