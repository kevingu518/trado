import React from 'react'
import { Popover, Button, Tag } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { SHORTCUT_REGISTRY } from './shortcutRegistry'
import { SCOPE_LABELS } from './scopes'
import { useShortcutSettings } from './ShortcutSettingsContext'

const kbdStyle = {
  padding: '1px 6px',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  background: '#fafafa',
  fontFamily: 'monospace',
  fontSize: 12,
  minWidth: 24,
  textAlign: 'center',
  display: 'inline-block',
  color: '#1a1a1a',
}

const ShortcutListPopover = () => {
  const { settings, isShortcutEnabled } = useShortcutSettings()

  const grouped = SHORTCUT_REGISTRY.reduce((acc, item) => {
    if (!acc[item.scope]) acc[item.scope] = []
    acc[item.scope].push(item)
    return acc
  }, {})

  const content = (
    <div className="thin-scrollbar" style={{ width: 260, maxHeight: 360, overflowY: 'auto' }}>
      {!settings.enabled && (
        <div style={{
          fontSize: 12,
          color: '#ad6800',
          background: '#fff7e6',
          padding: '6px 8px',
          borderRadius: 6,
          marginBottom: 8,
        }}>
          快捷鍵已停用（可至設定 → 快捷鍵啟用）
        </div>
      )}
      {Object.entries(grouped).map(([scope, items]) => {
        const scopeEnabled = isShortcutEnabled(scope)
        return (
          <div key={scope} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              opacity: scopeEnabled ? 1 : 0.5,
            }}>
              {SCOPE_LABELS[scope] || scope}
              {!scopeEnabled && (
                <Tag style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px' }}>已停用</Tag>
              )}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 0',
                  color: scopeEnabled ? '#1a1a1a' : '#999',
                }}
              >
                <span style={kbdStyle}>{item.display || item.keys}</span>
                <span style={{ fontSize: 12 }}>{item.description}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )

  return (
    <Popover
      content={content}
      title="鍵盤快捷鍵"
      placement="rightBottom"
      trigger="hover"
      mouseEnterDelay={0.1}
    >
      <Button
        type="text"
        className="theme-switcher-btn"
        title="鍵盤快捷鍵"
        style={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThunderboltOutlined />
      </Button>
    </Popover>
  )
}

export default ShortcutListPopover
