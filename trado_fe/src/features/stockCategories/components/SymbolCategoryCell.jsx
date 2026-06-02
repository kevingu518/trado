import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, Button, Empty, Input, Tooltip, message } from 'antd';
import { DownOutlined, CheckOutlined, CloseCircleFilled, CloseOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';
import CategoryTag from './CategoryTag';
import { useTheme } from '@/contexts/ThemeContext';
import '../styles/index.scss';

/**
 * 在表格 cell 內顯示 symbol 對應的族群 tag，並支援點擊切換族群。
 *
 * props:
 *   symbol            string
 *   categoryId        string | null
 *   categories        StockCategory[]   族群列表（含 id / name / color）
 *   onSelect(symbol, categoryId|null)   設定 / 移除 族群
 */
// hex → rgba（給 selected bg 用）
const hexToRgba = (hex, alpha) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SymbolCategoryCell = ({ symbol, categoryId, categories = [], onSelect }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState(false);
  const searchInputRef = useRef(null);
  const current = categories.find((c) => c.id === categoryId) || null;

  // 打開時清空搜尋並 focus
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

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

  // 右側 suffix icon：只在 query 有字時顯示灰 × 清搜尋
  const renderSuffix = () => {
    if (query) {
      return (
        <CloseCircleFilled
          style={{ color: '#bfbfbf', cursor: 'pointer', fontSize: 12 }}
          onClick={() => {
            setQuery('');
            searchInputRef.current?.focus();
          }}
        />
      );
    }
    return <span />;
  };

  const content = (
    <div
      className="SymbolCategoryPopover"
      style={{ width: 220, padding: 4 }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {/* search + clear (× overlays right side so input keeps full width) */}
      <div style={{ position: 'relative', marginBottom: 6, paddingRight: 4 }}>
        <Input
          ref={searchInputRef}
          className="rounded-sm"
          placeholder="搜尋族群…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          suffix={renderSuffix()}
          style={{ width: '100%', height: 28, paddingRight: current && !query ? 28 : undefined }}
        />
        {current && !query && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              zIndex: 2,
              display: 'inline-flex',
            }}
          >
            <Tooltip title="清除族群" placement="top">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ fontSize: 11 }} />}
                onClick={() => !busy && handlePick(null)}
                style={{
                  color: '#999',
                  width: 20,
                  height: 20,
                  minWidth: 20,
                  padding: 0,
                }}
              />
            </Tooltip>
          </span>
        )}
      </div>

      {/* list */}
      {categories.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未建立族群"
          style={{ margin: '8px 0' }}
        />
      ) : filtered.length === 0 ? (
        <div style={{ padding: '12px 4px', textAlign: 'center', color: '#999', fontSize: 12 }}>
          找不到符合的族群
        </div>
      ) : (
        <PerfectScrollbar
          options={{ suppressScrollX: true }}
          style={{ maxHeight: 260 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 4 }}>
            {filtered.map((c) => {
              const isSelected = c.id === categoryId;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !busy && handlePick(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!busy) handlePick(c.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: busy ? 'wait' : 'pointer',
                    background: isSelected ? hexToRgba(theme.primary, 0.1) : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <CategoryTag color={c.color} size="sm">{c.name}</CategoryTag>
                  {isSelected && (
                    <CheckOutlined style={{ color: theme.primary, fontSize: 12 }} />
                  )}
                </div>
              );
            })}
          </div>
        </PerfectScrollbar>
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
      overlayInnerStyle={{ padding: 4 }}
    >
      {current ? (
        <CategoryTag
          color={current.color}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ cursor: 'pointer' }}
        >
          {current.name}
          <DownOutlined
            style={{
              fontSize: 10,
              marginLeft: hover || open ? 4 : 0,
              maxWidth: hover || open ? 12 : 0,
              opacity: hover || open ? 1 : 0,
              overflow: 'hidden',
              transition: 'opacity 0.15s, max-width 0.15s, margin-left 0.15s',
            }}
          />
        </CategoryTag>
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
