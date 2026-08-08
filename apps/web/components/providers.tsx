"use client"

import React, { Suspense, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemberProvider } from "@/components/member-provider"
import { PhoneRequiredGate } from "@/components/phone-required-gate"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <MemberProvider>
        <Suspense fallback={children}>
          <PhoneRequiredGate>{children}</PhoneRequiredGate>
        </Suspense>
      </MemberProvider>
    </QueryClientProvider>
  )
}
