import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Popconfirm, Tooltip } from 'antd';
import {
  HolderOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import TargetRatioInlineEditor from './TargetRatioInlineEditor';
import CategoryTag from './CategoryTag';

const CategoryRow = ({
  category,
  onEdit,
  onDelete,
  onUpdateTarget,
  onMoveToOtherPool,
  showTarget = true,
  dimmed = false,
}) => {
  const stopPropagation = (e) => e.stopPropagation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? '#fafafa' : 'transparent',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
    opacity: isDragging ? 0.95 : dimmed ? 0.75 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="CategoryRow"
    >
      <div
        {...attributes}
        {...listeners}
        role={onMoveToOtherPool ? 'button' : undefined}
        tabIndex={onMoveToOtherPool ? 0 : undefined}
        onClick={onMoveToOtherPool ? () => onMoveToOtherPool(category) : undefined}
        title={
          onMoveToOtherPool
            ? category.isStandby
              ? '點擊移到「目標」／拖曳排序'
              : '點擊移到「觀察」／拖曳排序'
            : '拖曳排序'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid #f0f0f0',
          gap: 12,
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) e.currentTarget.style.background = '#fafafa';
        }}
        onMouseLeave={(e) => {
          if (!isDragging) e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* drag handle (視覺提示，實際 listener 在整列) */}
        <span
          aria-hidden
          style={{
            color: '#bbb',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 2px',
          }}
        >
          <HolderOutlined style={{ fontSize: 14 }} />
        </span>

        {/* tag */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CategoryTag color={category.color} size="sm">{category.name}</CategoryTag>
        </div>

        {/* holding count */}
        <div
          style={{
            color: category.symbolCount > 0 ? '#888' : '#ccc',
            fontSize: 12,
            minWidth: 56,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {category.symbolCount} 檔
        </div>

        {/* target ratio inline — standby pool 不顯示 */}
        {showTarget && (
          <div
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
            style={{
              minWidth: 110,
              textAlign: 'right',
              fontSize: 13,
              cursor: 'default',
            }}
          >
            <span style={{ color: '#999', fontSize: 12, marginRight: 4 }}>目標</span>
            <TargetRatioInlineEditor
              value={category.targetRatio}
              onChange={(r) => onUpdateTarget(category, r)}
            />
          </div>
        )}

        {/* actions */}
        <div
          style={{ display: 'flex', gap: 2, cursor: 'default' }}
          onClick={stopPropagation}
          onPointerDown={stopPropagation}
        >
          {onMoveToOtherPool && (
            <Tooltip
              title={category.isStandby ? '移到「目標」' : '移到「觀察」'}
            >
              <Button
                type="text"
                size="small"
                icon={
                  category.isStandby ? (
                    <ArrowLeftOutlined />
                  ) : (
                    <ArrowRightOutlined />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToOtherPool(category);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="編輯名稱 / 顏色">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(category);
              }}
            />
          </Tooltip>
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
            <Tooltip title="刪除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
};

export default CategoryRow;
