import React, { useState, useMemo } from 'react';
import { Popconfirm, Button, Tooltip } from 'antd';
import { CloseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';
import { useDroppable } from '@dnd-kit/core';
import CategoryTag from './CategoryTag';
import { COLOR_NAMES } from '../themePalette';

// 預設色 → 群組名稱（族群預設色帶有此含義）
const COLOR_GROUP_TITLE = {
  blue: '半導體',
  indigo: 'AI / 光通訊',
  cyan: '電子零組件',
  yellow: '金融',
  orange: '傳產',
  pink: '航運',
  green: '綠能 / 車',
  purple: '其他',
};

// 顏色顯示順序（沒被 mapping 到的色名歸到 "其他自訂"）
const COLOR_ORDER = ['blue', 'indigo', 'cyan', 'yellow', 'orange', 'pink', 'green', 'purple'];

/**
 * 觀察 pool — 改用依顏色分組的 chip 群呈現
 *
 * 互動：
 *  - 點 chip      → 切回目標 pool（onMoveToTarget）
 *  - hover chip   → 顯示 ✎ / × 兩個小按鈕
 *  - 仍是 Droppable（接收從目標拖過來的族群）
 *  - chip 不可拖（觀察清單通常密集、不需排序）
 */
const WatchlistGroups = ({
  poolId,
  items,
  onMoveToTarget,
  onEdit,
  onDelete,
  onAdd,
  isAtLimit,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: poolId });

  const grouped = useMemo(() => {
    const map = new Map();
    for (const name of COLOR_ORDER) map.set(name, []);
    const other = []; // 沒在 COLOR_ORDER 內的顏色（自訂色）

    for (const item of items) {
      if (COLOR_GROUP_TITLE[item.color]) {
        map.get(item.color).push(item);
      } else {
        other.push(item);
      }
    }

    const groups = COLOR_ORDER
      .map((color) => ({
        color,
        title: COLOR_GROUP_TITLE[color],
        items: map.get(color),
      }))
      .filter((g) => g.items.length > 0);

    if (other.length > 0) {
      groups.push({ color: 'mixed', title: '其他自訂', items: other });
    }
    return groups;
  }, [items]);

  return (
    <PerfectScrollbar
      containerRef={(el) => {
        if (el) setNodeRef(el);
      }}
      style={{
        flex: 1,
        minHeight: 0,
        background: isOver ? '#f0f7ff' : 'transparent',
        transition: 'background 0.15s',
        padding: '8px 0',
      }}
    >
      {items.length === 0 ? (
        <div
          style={{
            padding: '40px 16px',
            textAlign: 'center',
            color: '#bbb',
            fontSize: 13,
          }}
        >
          拖曳族群到這裡，或
          <button
            type="button"
            onClick={onAdd}
            disabled={isAtLimit}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#1677ff',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              marginLeft: 4,
            }}
          >
            新增一個
          </button>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.color} style={{ padding: '6px 12px 10px' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#888',
                marginBottom: 6,
                letterSpacing: 0.4,
              }}
            >
              {group.title}
              <span style={{ marginLeft: 6, fontWeight: 'normal', color: '#bbb' }}>
                {group.items.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.items.map((c) => (
                <WatchlistChip
                  key={c.id}
                  category={c}
                  onMoveToTarget={onMoveToTarget}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </PerfectScrollbar>
  );
};

// 單一觀察 chip — hover 顯示動作按鈕
const WatchlistChip = ({ category, onMoveToTarget, onEdit, onDelete }) => {
  const [hover, setHover] = useState(false);

  const stop = (e) => e.stopPropagation();

  return (
    <Tooltip title="點擊移到「目標」" mouseEnterDelay={0.4}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onMoveToTarget(category)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onMoveToTarget(category);
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <CategoryTag color={category.color} size="sm">
          {category.name}
        </CategoryTag>
        {hover && (
          <span
            onClick={stop}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              marginLeft: 1,
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: 11 }} />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(category);
              }}
              style={{ width: 20, height: 20, padding: 0, minWidth: 0 }}
            />
            <Popconfirm
              title="確定刪除此族群？"
              description={
                category.symbolCount > 0
                  ? `${category.symbolCount} 檔持股將取消歸類`
                  : '此族群尚未歸類任何持股'
              }
              onConfirm={() => onDelete(category)}
              okText="刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<CloseOutlined style={{ fontSize: 11 }} />}
                onClick={stop}
                style={{ width: 20, height: 20, padding: 0, minWidth: 0 }}
              />
            </Popconfirm>
          </span>
        )}
      </div>
    </Tooltip>
  );
};

export default WatchlistGroups;
