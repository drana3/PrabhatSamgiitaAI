"use client"

import React, { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemberProvider } from "@/components/member-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><MemberProvider>{children}</MemberProvider></QueryClientProvider>
}
