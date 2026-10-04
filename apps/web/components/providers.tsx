"use client"

import React, { Suspense, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthSessionRecovery } from "@/components/auth-session-recovery"
import { MemberProvider } from "@/components/member-provider"
import { EasyAuthSessionBootstrap } from "@/components/easy-auth-session-bootstrap"
import { PhoneRequiredGate } from "@/components/phone-required-gate"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <MemberProvider>
        <AuthSessionRecovery />
        <EasyAuthSessionBootstrap />
        <Suspense fallback={null}>
          <PhoneRequiredGate>{children}</PhoneRequiredGate>
        </Suspense>
      </MemberProvider>
    </QueryClientProvider>
  )
}
