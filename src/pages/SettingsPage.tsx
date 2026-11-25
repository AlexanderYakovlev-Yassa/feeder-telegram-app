import { useTranslation } from 'react-i18next'
import { Cell, List, Section, SegmentedControl } from '@telegram-apps/telegram-ui'
import { Globe, Info, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { hapticSelection } from '../utils/telegram'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { username, telegramUserId } = useAuth()

  const changeLang = (lang: 'ru' | 'en') => {
    hapticSelection()
    void i18n.changeLanguage(lang)
  }

  return (
    <List>
      <Section header={t('settings.title')}>
        <Cell before={<User size={18} />} after={username ?? '—'}>
          {t('settings.user')}
        </Cell>
        <Cell before={<Info size={18} />} after={telegramUserId ? String(telegramUserId) : '—'}>
          {t('settings.telegramId')}
        </Cell>
        <Cell before={<Globe size={18} />}>
          {t('settings.language')}
        </Cell>
        <div style={{ padding: '4px 16px 12px' }}>
          <SegmentedControl>
            <SegmentedControl.Item
              selected={i18n.language.startsWith('ru')}
              onClick={() => changeLang('ru')}
            >
              Русский
            </SegmentedControl.Item>
            <SegmentedControl.Item
              selected={i18n.language.startsWith('en')}
              onClick={() => changeLang('en')}
            >
              English
            </SegmentedControl.Item>
          </SegmentedControl>
        </div>
      </Section>

      <Section header={t('settings.webHintTitle')}>
        <Cell multiline subtitle={t('settings.webHintDesc')}>
          Web UI
        </Cell>
      </Section>
    </List>
  )
}
