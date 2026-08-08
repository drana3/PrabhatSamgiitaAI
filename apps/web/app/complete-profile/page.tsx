import { CompletePhoneForm } from "@/components/complete-phone-form"
import { safeSignInNextPath } from "@/lib/sign-in"

export const dynamic = "force-dynamic"

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const next = safeSignInNextPath(params.next)
  return (
    <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 py-12">
      <CompletePhoneForm next={next} />
    </main>
  )
}
