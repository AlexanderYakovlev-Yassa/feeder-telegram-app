export interface TelegramWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  colorScheme?: 'light' | 'dark'
  platform?: string
  ready: () => void
  expand: () => void
  onEvent?: (eventType: string, cb: () => void) => void
  offEvent?: (eventType: string, cb: () => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

export function isRunningInTelegram(): boolean {
  const tg = getTelegramWebApp()
  return Boolean(tg && tg.initData && tg.initData.length > 0)
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred(style)
  } catch {
    // ignore outside Telegram
  }
}

export function hapticNotify(type: 'success' | 'error' | 'warning'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type)
  } catch {
    // ignore outside Telegram
  }
}

export function hapticSelection(): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.selectionChanged()
  } catch {
    // ignore outside Telegram
  }
}
