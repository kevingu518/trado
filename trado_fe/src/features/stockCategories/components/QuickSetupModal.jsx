import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Checkbox, Button } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';
import { PRESET_CATEGORIES, PRESET_GROUPS } from '../config';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * 第一次使用：用勾選方式快速建立多個預設族群
 */
const QuickSetupModal = ({ visible, onClose, onConfirm, loading = false }) => {
  const { theme } = useTheme();
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!visible) return;
    const init = new Set(
      PRESET_CATEGORIES.filter((p) => p.defaultChecked).map((p) => p.name),
    );
    setSelected(init);
  }, [visible]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const g of PRESET_GROUPS) map.set(g, []);
    for (const item of PRESET_CATEGORIES) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    }
    return [...map.entries()];
  }, []);

  const toggle = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleGroup = (groupItems, checkAll) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of groupItems) {
        if (checkAll) next.add(item.name);
        else next.delete(item.name);
      }
      return next;
    });
  };

  const selectedCount = selected.size;

  const handleConfirm = async () => {
    const items = PRESET_CATEGORIES.filter((p) => selected.has(p.name)).map(
      (p, idx) => ({
        name: p.name,
        color: p.color,
        sortOrder: idx,
      }),
    );
    if (items.length === 0) return;
    await onConfirm(items);
  };

  return (
    <Modal
      title="快速建立常用族群"
      open={visible}
      onCancel={onClose}
      width={720}
      destroyOnClose
      styles={{ body: { padding: '8px 0 4px' } }}
      footer={[
        <span key="count" style={{ marginRight: 'auto', color: '#888', fontSize: 13 }}>
          已選 <b style={{ color: theme.primary }}>{selectedCount}</b> 個
        </span>,
        <Button key="cancel" onClick={onClose} disabled={loading}>
          取消
        </Button>,
        <Button
          key="ok"
          type="primary"
          onClick={handleConfirm}
          loading={loading}
          disabled={selectedCount === 0}
        >
          建立 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </Button>,
      ]}
    >
      <PerfectScrollbar
        options={{ suppressScrollX: true }}
        style={{ maxHeight: 520, padding: '0 4px' }}
      >
        {grouped.map(([groupName, items], gi) => {
          if (items.length === 0) return null;
          const checkedInGroup = items.filter((i) => selected.has(i.name)).length;
          const allChecked = checkedInGroup === items.length;
          const someChecked = checkedInGroup > 0 && !allChecked;
          return (
            <section
              key={groupName}
              style={{
                marginTop: gi === 0 ? 0 : 4,
                paddingBottom: 8,
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 4px 8px',
                  borderBottom: '1px solid #f0f0f0',
                  marginBottom: 10,
                }}
              >
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={(e) => toggleGroup(items, e.target.checked)}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{groupName}</span>
                </Checkbox>
                <span
                  style={{
                    color: checkedInGroup > 0 ? theme.primary : '#bbb',
                    fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {checkedInGroup} / {items.length}
                </span>
              </header>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px' }}>
                {items.map((item) => {
                  const checked = selected.has(item.name);
                  return (
                    <Chip
                      key={item.name}
                      checked={checked}
                      onClick={() => toggle(item.name)}
                      primary={theme.primary}
                      primaryLight={theme.primaryLight}
                    >
                      {item.name}
                    </Chip>
                  );
                })}
              </div>
            </section>
          );
        })}
      </PerfectScrollbar>
    </Modal>
  );
};

const Chip = ({ checked, onClick, children, primary, primaryLight }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 12px',
      borderRadius: 4,
      border: checked ? `1.5px solid ${primary}` : '1px solid #e0e0e0',
      background: '#fff',
      color: checked ? primary : '#595959',
      fontWeight: checked ? 500 : 400,
      fontSize: 13,
      lineHeight: 1.4,
      cursor: 'pointer',
      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      fontFamily: 'inherit',
      userSelect: 'none',
    }}
    onMouseEnter={(e) => {
      if (!checked) {
        e.currentTarget.style.borderColor = primaryLight;
        e.currentTarget.style.color = primary;
      }
    }}
    onMouseLeave={(e) => {
      if (!checked) {
        e.currentTarget.style.borderColor = '#e0e0e0';
        e.currentTarget.style.color = '#595959';
      }
    }}
  >
    {checked && <CheckOutlined style={{ fontSize: 10 }} />}
    {children}
  </button>
);

export default QuickSetupModal;
