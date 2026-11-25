import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, loginWithPassword, loginWithTelegram } from '../api/client'
import { getTelegramWebApp, isRunningInTelegram } from '../utils/telegram'

interface JwtPayload {
  userId?: number
  sub?: string
  exp?: number
}

function parseJwt(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload
  } catch {
    return null
  }
}

export type AuthStatus = 'loading' | 'authenticated' | 'not_linked' | 'outside_telegram' | 'error'

export interface AuthContextValue {
  token: string | null
  userId: number | null
  username: string | null
  telegramUserId: number | null
  status: AuthStatus
  error: string | null
  authenticateTelegram: () => Promise<void>
  loginDev: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const tg = getTelegramWebApp()
  const telegramUserId = tg?.initDataUnsafe?.user?.id ?? null

  const applyToken = useCallback((jwt: string) => {
    const payload = parseJwt(jwt)
    setToken(jwt)
    setUserId(typeof payload?.userId === 'number' ? payload.userId : null)
    setUsername(payload?.sub ?? null)
    setStatus('authenticated')
    setError(null)
  }, [])

  const authenticateTelegram = useCallback(async () => {
    const webApp = getTelegramWebApp()
    webApp?.ready()
    webApp?.expand()

    if (!isRunningInTelegram() || !webApp?.initData) {
      setStatus('outside_telegram')
      return
    }

    setStatus('loading')
    setError(null)
    try {
      const jwt = await loginWithTelegram(webApp.initData)
      applyToken(jwt)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setStatus('not_linked')
      } else {
        setStatus('error')
      }
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }, [applyToken])

  const loginDev = useCallback(
    async (user: string, pass: string) => {
      setStatus('loading')
      setError(null)
      try {
        const jwt = await loginWithPassword(user, pass)
        applyToken(jwt)
      } catch (err) {
        setStatus('outside_telegram')
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    },
    [applyToken],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUserId(null)
    setUsername(null)
    setStatus(isRunningInTelegram() ? 'loading' : 'outside_telegram')
  }, [])

  useEffect(() => {
    void authenticateTelegram()
  }, [authenticateTelegram])

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        username,
        telegramUserId,
        status,
        error,
        authenticateTelegram,
        loginDev,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
