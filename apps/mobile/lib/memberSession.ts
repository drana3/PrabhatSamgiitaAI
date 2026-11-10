/**
 * The member's signed session tokens (docs/security-member-auth.md).
 *
 * The server hands out a short-lived access token and a long-lived refresh token after it has checked the
 * sign-in with the provider. They are kept in the phone's secure storage (Keychain / Keystore through
 * expo-secure-store), never in AsyncStorage and never in a backup. A copy lives in memory so request headers
 * can be built without waiting for the disk.
 *
 * Everything here talks to the API through a `baseUrl` that the caller passes in, so this file does not
 * depend on lib/client.ts (which depends on it).
 */

const STORAGE_KEY = "ps.member.session.v1"
const REFRESH_EARLY_MS = 120_000
const KEEP_ALIVE_MS = 5 * 60_000

export type MemberTokens = {
  accessToken: string
  refreshToken: string
  /** epoch ms when the access token stops working */
  expiresAt: number
  accountId: string | null
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  account_id?: string | null
}

export type TokenStore = {
  read: () => Promise<string | null>
  write: (value: string) => Promise<void>
  remove: () => Promise<void>
}

let configuredBaseUrl = ""

/** lib/client.ts tells this module where the API is, so screens and sign-in code need not import the client. */
export function configureMemberSession(baseUrl: string) {
  configuredBaseUrl = baseUrl
}

export function memberSessionBaseUrl() {
  return configuredBaseUrl
}

let current: MemberTokens | null = null
let refreshing: Promise<MemberTokens | null> | null = null
let store: TokenStore | null = null
let now: () => number = () => Date.now()
let fetchImpl: typeof fetch = (...args) => fetch(...args)
const listeners = new Set<() => void>()

/** Secure storage when the platform has it (iOS, Android); memory only on the web preview. */
async function defaultStore(): Promise<TokenStore> {
  try {
    const SecureStore = await import("expo-secure-store")
    if (await SecureStore.isAvailableAsync()) {
      return {
        read: () => SecureStore.getItemAsync(STORAGE_KEY),
        write: (value) => SecureStore.setItemAsync(STORAGE_KEY, value),
        remove: () => SecureStore.deleteItemAsync(STORAGE_KEY),
      }
    }
  } catch {
    // no native module in this build: fall through to memory
  }
  let memory: string | null = null
  return {
    read: async () => memory,
    write: async (value) => {
      memory = value
    },
    remove: async () => {
      memory = null
    },
  }
}

async function activeStore(): Promise<TokenStore> {
  if (!store) store = await defaultStore()
  return store
}

function notify() {
  for (const listener of listeners) listener()
}

/** Called when tokens appear or disappear (so a screen can re-check `memberAuthAvailable`). */
export function onMemberTokensChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function tokensFromResponse(response: TokenResponse, at = now()): MemberTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: at + Math.max(30, response.expires_in) * 1000,
    accountId: response.account_id ?? null,
  }
}

function parseStored(raw: string | null): MemberTokens | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<MemberTokens>
    if (
      typeof value.accessToken === "string" &&
      typeof value.refreshToken === "string" &&
      typeof value.expiresAt === "number"
    ) {
      return {
        accessToken: value.accessToken,
        refreshToken: value.refreshToken,
        expiresAt: value.expiresAt,
        accountId: typeof value.accountId === "string" ? value.accountId : null,
      }
    }
  } catch {
    // damaged value: treated as "not signed in with tokens"
  }
  return null
}

/** Reads the tokens from secure storage into memory. Call once at launch, before the first member request. */
export async function hydrateMemberSession(): Promise<MemberTokens | null> {
  try {
    current = parseStored(await (await activeStore()).read())
  } catch {
    current = null
  }
  notify()
  return current
}

let hydration: Promise<MemberTokens | null> | null = null

/** Hydrates once per launch; later callers get the same answer. */
export function ensureMemberSessionHydrated(): Promise<MemberTokens | null> {
  if (!hydration) hydration = hydrateMemberSession()
  return hydration
}

export async function saveMemberTokens(tokens: MemberTokens): Promise<void> {
  current = tokens
  try {
    await (await activeStore()).write(JSON.stringify(tokens))
  } catch {
    // the in-memory copy still works for this launch
  }
  notify()
}

/** Forgets the tokens on this phone (sign-out, deleted account, session ended by the server). */
export async function clearMemberTokens(): Promise<void> {
  current = null
  try {
    await (await activeStore()).remove()
  } catch {
    // nothing else to do
  }
  notify()
}

export function currentMemberTokens(): MemberTokens | null {
  return current
}

export function hasMemberTokens(): boolean {
  return current !== null
}

/** `Authorization: Bearer …`, or `{}` when this phone has no session tokens. Synchronous on purpose. */
export function bearerHeaders(): Record<string, string> {
  return current ? { Authorization: `Bearer ${current.accessToken}` } : {}
}

export function accessTokenIsFresh(tokens: MemberTokens | null = current, at = now()): boolean {
  return Boolean(tokens) && (tokens as MemberTokens).expiresAt - at > REFRESH_EARLY_MS
}

async function postJson(baseUrl: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetchImpl(`${baseUrl}/api/v1/members/session/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

export type ProviderProof = {
  provider: "google" | "apple" | "aad"
  idToken?: string | null
  /** Apple only: see OAuthIdentity.authorizationCode. */
  authorizationCode?: string | null
  deviceLabel?: string
}

/**
 * Trades the provider's own signed proof for our session tokens. Returns null when the server cannot do it
 * (not set up yet, offline, proof refused): the caller then carries on with the old path or tells the person.
 */
export async function exchangeProviderProof(
  baseUrl: string,
  proof: ProviderProof,
): Promise<MemberTokens | null> {
  // A new sign-in must never keep the previous person's tokens, whatever happens next.
  await clearMemberTokens()
  if (!proof.idToken) return null
  try {
    const response = await postJson(baseUrl, "exchange", {
      provider: proof.provider,
      id_token: proof.idToken ?? undefined,
      ...(proof.provider === "apple" && proof.authorizationCode
        ? { authorization_code: proof.authorizationCode }
        : {}),
      device_label: proof.deviceLabel,
    })
    if (!response.ok) return null
    const tokens = tokensFromResponse((await response.json()) as TokenResponse)
    await saveMemberTokens(tokens)
    return tokens
  } catch {
    return null
  }
}

/** Keeps the tokens a password sign-in returned (the server sends them with the sign-in answer). */
export async function adoptTokenResponse(
  response:
    | {
        access_token?: string | null
        refresh_token?: string | null
        expires_in?: number | null
        account_id?: string | null
      }
    | null
    | undefined,
) {
  if (!response?.access_token || !response.refresh_token || !response.expires_in) {
    // A new sign-in must never keep the previous person's tokens around.
    await clearMemberTokens()
    return null
  }
  const tokens = tokensFromResponse({
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_in: response.expires_in,
    account_id: response.account_id,
  })
  await saveMemberTokens(tokens)
  return tokens
}

async function refreshNow(baseUrl: string): Promise<MemberTokens | null> {
  const held = current
  if (!held) return null
  try {
    const response = await postJson(baseUrl, "refresh", { refresh_token: held.refreshToken })
    if (response.status === 401) {
      // the server ended this session (signed out elsewhere, password reset, copy detected): sign in again
      await clearMemberTokens()
      return null
    }
    if (!response.ok) return held // server trouble: keep what we have and retry later
    const tokens = tokensFromResponse((await response.json()) as TokenResponse)
    await saveMemberTokens(tokens)
    return tokens
  } catch {
    return held // offline: keep what we have
  }
}

/** One refresh at a time; everybody who asks while one is running waits for the same answer. */
export function ensureFreshAccessToken(baseUrl: string, force = false): Promise<MemberTokens | null> {
  if (!current) return Promise.resolve(null)
  if (!force && accessTokenIsFresh()) return Promise.resolve(current)
  if (!refreshing) {
    refreshing = refreshNow(baseUrl).finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** Signs this device out on the server too. Best effort: the local tokens are gone either way. */
export async function revokeMemberSession(baseUrl: string, allDevices = false): Promise<void> {
  const held = current
  await clearMemberTokens()
  if (!held) return
  try {
    await postJson(baseUrl, "revoke", { all_devices: allDevices }, { Authorization: `Bearer ${held.accessToken}` })
  } catch {
    // The server drops the session when the refresh token expires anyway.
  }
}

let keepAlive: ReturnType<typeof setInterval> | null = null

/** Refreshes in the background so synchronous header builders always find a fresh token. */
export function startMemberSessionKeepAlive(baseUrl: string) {
  if (keepAlive) return () => undefined
  keepAlive = setInterval(() => {
    void ensureFreshAccessToken(baseUrl)
  }, KEEP_ALIVE_MS)
  return () => {
    if (keepAlive) clearInterval(keepAlive)
    keepAlive = null
  }
}

/** Test hooks: swap storage, clock and fetch, and reset memory. */
export const __testing = {
  reset() {
    current = null
    refreshing = null
    hydration = null
    configuredBaseUrl = ""
    store = null
    now = () => Date.now()
    fetchImpl = (...args) => fetch(...args)
    listeners.clear()
  },
  useStore(next: TokenStore) {
    store = next
  },
  useClock(next: () => number) {
    now = next
  },
  useFetch(next: typeof fetch) {
    fetchImpl = next
  },
}
