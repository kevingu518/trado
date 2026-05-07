import React from 'react'
import { Modal, Tag, Empty } from 'antd'
import { SHORTCUT_REGISTRY } from './shortcutRegistry'
import { SCOPE_LABELS } from './scopes'
import { useShortcutSettings } from './ShortcutSettingsContext'

const ShortcutHelpModal = ({ open, onClose }) => {
  const { settings, isShortcutEnabled } = useShortcutSettings()

  // 依 scope 分組
  const grouped = SHORTCUT_REGISTRY.reduce((acc, item) => {
    if (!acc[item.scope]) acc[item.scope] = []
    acc[item.scope].push(item)
    return acc
  }, {})

  return (
    <Modal
      title="鍵盤快捷鍵"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {!settings.enabled && (
        <div style={{ padding: 12, marginBottom: 16, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8 }}>
          快捷鍵目前已停用。可至「設定 → 快捷鍵」啟用。
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <Empty description="尚未註冊任何快捷鍵" />
      ) : (
        Object.entries(grouped).map(([scope, items]) => {
          const scopeEnabled = isShortcutEnabled(scope)
          return (
            <div key={scope} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, opacity: scopeEnabled ? 1 : 0.5 }}>
                {SCOPE_LABELS[scope] || scope}
                {!scopeEnabled && <Tag style={{ marginLeft: 8 }}>已停用</Tag>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: '6px 0', width: 100 }}>
                        <kbd style={{
                          padding: '2px 8px',
                          border: '1px solid #d9d9d9',
                          borderRadius: 4,
                          background: '#fafafa',
                          fontFamily: 'monospace',
                          fontSize: 13,
                        }}>
                          {item.display || item.keys}
                        </kbd>
                      </td>
                      <td style={{ padding: '6px 0', color: scopeEnabled ? '#1a1a1a' : '#999' }}>
                        {item.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </Modal>
  )
}

export default ShortcutHelpModal
