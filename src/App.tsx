import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AppRoot,
  Button,
  Input,
  List,
  Placeholder,
  Section,
  Spinner,
  Tabbar,
} from '@telegram-apps/telegram-ui'
import { CalendarClock, Plug, Settings, Utensils, Video } from 'lucide-react'
import { fetchUserDevices } from './api/client'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CameraPage } from './pages/CameraPage'
import { FeederPage } from './pages/FeederPage'
import { PlugsPage } from './pages/PlugsPage'
import { SchedulePage } from './pages/SchedulePage'
import { SettingsPage } from './pages/SettingsPage'
import type { DeviceDto } from './types/api'
import { getTelegramWebApp, hapticSelection } from './utils/telegram'

type TabId = 'feeder' | 'schedule' | 'camera' | 'plugs' | 'settings'

function DevLoginScreen() {
  const { t } = useTranslation()
  const { loginDev, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <List>
      <Placeholder
        header={t('auth.outsideTelegramTitle')}
        description={t('auth.outsideTelegramDesc')}
      />
      <Section>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input
            placeholder={t('auth.username')}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && (
            <div style={{ color: 'var(--tgui--destructive_text_color)', fontSize: 13 }}>
              {error}
            </div>
          )}
          <Button
            size="l"
            stretched
            onClick={() => void loginDev(username, password)}
          >
            {t('auth.loginBtn')}
          </Button>
        </div>
      </Section>
    </List>
  )
}

function MainShell() {
  const { t } = useTranslation()
  const { status, token, userId, telegramUserId, error, authenticateTelegram } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('feeder')
  const [devices, setDevices] = useState<DeviceDto[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DeviceDto | null>(null)
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !token || !userId) return
    setIsLoadingDevices(true)
    fetchUserDevices(userId, token)
      .then(list => {
        setDevices(list)
        setSelectedDevice(prev => prev ?? list[0] ?? null)
      })
      .catch(() => setDevices([]))
      .finally(() => setIsLoadingDevices(false))
  }, [status, token, userId])

  if (status === 'loading') {
    return (
      <Placeholder description={t('auth.loading')}>
        <Spinner size="l" />
      </Placeholder>
    )
  }

  if (status === 'not_linked' || status === 'error') {
    return (
      <Placeholder
        header={t('auth.notLinkedTitle')}
        description={
          status === 'not_linked'
            ? t('auth.notLinkedDesc', { id: telegramUserId ?? 'unknown' })
            : (error ?? 'Error')
        }
        action={
          <Button size="m" onClick={() => void authenticateTelegram()}>
            {t('auth.retryBtn')}
          </Button>
        }
      />
    )
  }

  if (status === 'outside_telegram') {
    return <DevLoginScreen />
  }

  return (
    <div className="tma-shell">
      <div className="tma-content">
        {activeTab === 'feeder' && (
          <FeederPage
            devices={devices}
            selectedDevice={selectedDevice}
            onSelectDevice={setSelectedDevice}
            isLoadingDevices={isLoadingDevices}
          />
        )}
        {activeTab === 'schedule' && <SchedulePage device={selectedDevice} />}
        {activeTab === 'camera' && <CameraPage />}
        {activeTab === 'plugs' && <PlugsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>

      <Tabbar className="tma-tabbar">
        <Tabbar.Item
          text={t('tabs.feeder')}
          selected={activeTab === 'feeder'}
          onClick={() => {
            hapticSelection()
            setActiveTab('feeder')
          }}
        >
          <Utensils size={22} />
        </Tabbar.Item>
        <Tabbar.Item
          text={t('tabs.schedule')}
          selected={activeTab === 'schedule'}
          onClick={() => {
            hapticSelection()
            setActiveTab('schedule')
          }}
        >
          <CalendarClock size={22} />
        </Tabbar.Item>
        <Tabbar.Item
          text={t('tabs.camera')}
          selected={activeTab === 'camera'}
          onClick={() => {
            hapticSelection()
            setActiveTab('camera')
          }}
        >
          <Video size={22} />
        </Tabbar.Item>
        <Tabbar.Item
          text={t('tabs.plugs')}
          selected={activeTab === 'plugs'}
          onClick={() => {
            hapticSelection()
            setActiveTab('plugs')
          }}
        >
          <Plug size={22} />
        </Tabbar.Item>
        <Tabbar.Item
          text={t('tabs.settings')}
          selected={activeTab === 'settings'}
          onClick={() => {
            hapticSelection()
            setActiveTab('settings')
          }}
        >
          <Settings size={22} />
        </Tabbar.Item>
      </Tabbar>
    </div>
  )
}

export function App() {
  const [appearance, setAppearance] = useState<'light' | 'dark'>(
    () => getTelegramWebApp()?.colorScheme ?? 'dark',
  )

  useEffect(() => {
    const tg = getTelegramWebApp()
    if (!tg?.onEvent) return
    const handleTheme = () => {
      if (tg.colorScheme) setAppearance(tg.colorScheme)
    }
    tg.onEvent('themeChanged', handleTheme)
    return () => tg.offEvent?.('themeChanged', handleTheme)
  }, [])

  return (
    <AppRoot appearance={appearance} platform="base">
      <AuthProvider>
        <MainShell />
      </AuthProvider>
    </AppRoot>
  )
}

export default App
