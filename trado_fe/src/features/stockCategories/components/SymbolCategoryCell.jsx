import React, { useState } from 'react';
import { Tag, Popover, Button, Empty, message } from 'antd';
import { DownOutlined } from '@ant-design/icons';

/**
 * 在表格 cell 內顯示 symbol 對應的族群 tag，並支援點擊切換族群。
 *
 * props:
 *   symbol            string
 *   categoryId        string | null
 *   categories        StockCategory[]   族群列表（含 id / name / color）
 *   onSelect(symbol, categoryId|null)   設定 / 移除 族群
 */
const SymbolCategoryCell = ({ symbol, categoryId, categories = [], onSelect }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = categories.find((c) => c.id === categoryId) || null;

  const handlePick = async (newCatId) => {
    if (newCatId === categoryId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    const { err } = (await onSelect(symbol, newCatId)) || {};
    setBusy(false);
    if (err) {
      message.error(err.msg || err.message || '更新失敗');
      return;
    }
    setOpen(false);
  };

  const content = (
    <div style={{ width: 180, maxHeight: 260, overflowY: 'auto' }}>
      {categories.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未建立族群"
          style={{ margin: '8px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categories.map((c) => (
            <Button
              key={c.id}
              type="text"
              size="small"
              disabled={busy}
              onClick={() => handlePick(c.id)}
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                background: c.id === categoryId ? 'rgba(0,0,0,0.04)' : undefined,
              }}
            >
              <Tag color={c.color} style={{ marginRight: 6 }}>
                {c.name}
              </Tag>
              {c.id === categoryId && <span style={{ color: '#1677ff', fontSize: 12 }}>✓</span>}
            </Button>
          ))}
          {current && (
            <>
              <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />
              <Button
                type="text"
                size="small"
                danger
                disabled={busy}
                onClick={() => handlePick(null)}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                清除族群
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      destroyTooltipOnHide
    >
      {current ? (
        <Tag
          color={current.color}
          style={{ cursor: 'pointer', margin: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {current.name} <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
        </Tag>
      ) : (
        <Button
          type="text"
          size="small"
          style={{ color: '#999', padding: '0 6px', height: 22 }}
          onClick={(e) => e.stopPropagation()}
        >
          + 設定
        </Button>
      )}
    </Popover>
  );
};

export default SymbolCategoryCell;
