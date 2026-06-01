import React, { useState, useEffect, useRef } from 'react';
import { InputNumber, message } from 'antd';

/**
 * 表格內 inline 編輯目標佔比（%）
 * - 點擊文字 → 進入編輯（InputNumber 直接顯示）
 * - blur 或 Enter → 儲存
 * - Esc → 取消
 */
const TargetRatioInlineEditor = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === null || value === undefined ? null : value * 100);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value === null || value === undefined ? null : value * 100);
  }, [value]);

  useEffect(() => {
    if (editing) {
      // 等下個 tick 再 focus，確保 input 渲染完成
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const save = async () => {
    const original = value === null || value === undefined ? null : value * 100;
    const next = draft === null || draft === undefined || draft === '' ? null : Number(draft);
    // 沒變動 → 直接退出
    if (next === original) {
      setEditing(false);
      return;
    }
    if (next !== null && (next < 0 || next > 100)) {
      message.error('範圍 0 ~ 100');
      setDraft(original);
      setEditing(false);
      return;
    }
    setSaving(true);
    const ratio = next === null ? null : Number((next / 100).toFixed(4));
    const { err } = (await onChange(ratio)) || {};
    setSaving(false);
    if (err) {
      message.error(err.msg || err.message || '更新失敗');
      setDraft(original);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value === null || value === undefined ? null : value * 100);
    setEditing(false);
  };

  if (editing) {
    return (
      <InputNumber
        ref={inputRef}
        value={draft}
        onChange={setDraft}
        onBlur={save}
        onPressEnter={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
        }}
        min={0}
        max={100}
        precision={1}
        step={1}
        size="small"
        suffix="%"
        disabled={saving}
        style={{ width: 100 }}
      />
    );
  }

  const display =
    value === null || value === undefined ? (
      <span style={{ color: '#ccc' }}>未設</span>
    ) : (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(value * 100).toFixed(1)}%</span>
    );

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      style={{
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 3,
        display: 'inline-block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      title="點擊編輯"
    >
      {display}
    </span>
  );
};

export default TargetRatioInlineEditor;
