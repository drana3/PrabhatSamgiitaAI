"use client"

import { use } from "react"

import { AdminSargamPanel } from "@/components/admin-sargam-panel"

export default function AdminSargamSongPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params)
  const songNumber = Number(number)
  return <AdminSargamPanel initialNumber={Number.isInteger(songNumber) ? songNumber : undefined} />
}
