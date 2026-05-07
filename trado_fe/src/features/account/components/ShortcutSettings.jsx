import React from 'react'
import { Switch, Card, Table, Tag, Alert } from 'antd'
import {
  useShortcutSettings,
  SHORTCUT_REGISTRY,
  SCOPE_LABELS,
} from '@/shortcuts'

const ShortcutSettings = () => {
  const { settings, setEnabled, setScopeEnabled, isShortcutEnabled } = useShortcutSettings()

  // 只列出實際有快捷鍵的 scope，避免顯示空組
  const scopesInUse = [...new Set(SHORTCUT_REGISTRY.map((s) => s.scope))]

  const columns = [
    {
      title: '按鍵',
      dataIndex: 'display',
      key: 'display',
      width: 120,
      render: (display, record) => (
        <kbd style={{
          padding: '2px 8px',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          background: '#fafafa',
          fontFamily: 'monospace',
          fontSize: 13,
        }}>
          {display || record.keys}
        </kbd>
      ),
    },
    {
      title: '說明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '狀態',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const enabled = isShortcutEnabled(record.scope)
        return enabled
          ? <Tag color='green'>啟用中</Tag>
          : <Tag>已停用</Tag>
      },
    },
  ]

  return (
    <div className='flex flex-col gap-md'>
      <Card size='small' title='總開關'>
        <div className='useBetween'>
          <div>
            <div style={{ fontWeight: 500 }}>啟用快捷鍵</div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
              關閉後所有快捷鍵皆失效（包含全域與各頁面）
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onChange={setEnabled}
            checkedChildren='開'
            unCheckedChildren='關'
          />
        </div>
      </Card>

      {!settings.enabled && (
        <Alert
          type='warning'
          showIcon
          message='快捷鍵已全部停用'
          description='開啟總開關後，下方各分組才會生效。'
        />
      )}

      <Card size='small' title='分組設定'>
        <div className='flex flex-col gap-sm'>
          {scopesInUse.map((scope) => (
            <div key={scope} className='useBetween'>
              <span>{SCOPE_LABELS[scope] || scope}</span>
              <Switch
                checked={settings.enabledScopes[scope] ?? true}
                onChange={(v) => setScopeEnabled(scope, v)}
                disabled={!settings.enabled}
                checkedChildren='開'
                unCheckedChildren='關'
              />
            </div>
          ))}
        </div>
      </Card>

      {scopesInUse.map((scope) => {
        const items = SHORTCUT_REGISTRY.filter((s) => s.scope === scope)
        return (
          <Card key={scope} size='small' title={SCOPE_LABELS[scope] || scope}>
            <Table
              size='small'
              columns={columns}
              dataSource={items}
              rowKey='id'
              pagination={false}
            />
          </Card>
        )
      })}

      <div style={{ color: '#999', fontSize: 12, textAlign: 'center' }}>
        提示：在任意頁面按 <kbd style={{ padding: '0 6px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fafafa' }}>?</kbd> 可隨時叫出快捷鍵說明
      </div>
    </div>
  )
}

export default ShortcutSettings
