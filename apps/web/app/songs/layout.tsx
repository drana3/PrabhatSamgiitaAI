export default function SongsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="dns-prefetch" href="https://prabhatasamgiita.net" />
      <link rel="preconnect" href="https://prabhatasamgiita.net" crossOrigin="" />
      {children}
    </>
  )
}
