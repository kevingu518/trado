import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Spin, message, Space, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, InfoCircleOutlined, ClearOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import CategoryFormModal from './CategoryFormModal';
import CategoryRow from './CategoryRow';
import WatchlistGroups from './WatchlistGroups';

const POOL_ACTIVE = 'pool-active';
const POOL_STANDBY = 'pool-standby';

/**
 * 管理 Tab：兩個 pool — 目標 / 觀察
 * - 拖曳跨 pool 或點擊 row 切換狀態
 * - Pool 內拖曳排序
 * - 目標佔比 inline 編輯（觀察 pool 隱藏目標欄）
 */
const ManageView = ({
  list,
  loading,
  mutating,
  isAtLimit,
  maxCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDefaultStandby, setModalDefaultStandby] = useState(false);
  const [editing, setEditing] = useState(null);

  // 本地 DnD 狀態（拖曳期間反映即時順序），來源是 list prop
  const [localList, setLocalList] = useState(list);
  useEffect(() => setLocalList(list), [list]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeItems = useMemo(
    () => localList.filter((c) => !c.isStandby),
    [localList],
  );
  const standbyItems = useMemo(
    () => localList.filter((c) => c.isStandby),
    [localList],
  );

  const totalTargetRatio = useMemo(
    () => activeItems.reduce((sum, c) => sum + (c.targetRatio || 0), 0),
    [activeItems],
  );

  const handleAdd = (asStandby = false) => {
    setEditing(null);
    setModalDefaultStandby(asStandby);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    setModalDefaultStandby(record.isStandby);
    setModalVisible(true);
  };

  const handleSubmit = async (payload) => {
    const finalPayload = editing
      ? payload
      : { ...payload, isStandby: modalDefaultStandby };
    const op = editing
      ? updateCategory(editing.id, finalPayload)
      : createCategory(finalPayload);
    const { err } = await op;
    if (err) {
      message.error(err.msg || err.message || '操作失敗');
      return;
    }
    message.success(editing ? '已更新' : '已新增');
    setModalVisible(false);
    setEditing(null);
  };

  const handleDelete = async (record) => {
    const { err } = await deleteCategory(record.id);
    if (err) {
      message.error(err.msg || err.message || '刪除失敗');
      return;
    }
    message.success('已刪除');
  };

  const handleUpdateTarget = async (record, newRatio) => {
    return await updateCategory(record.id, { targetRatio: newRatio });
  };

  // 一鍵把目標區全部搬到觀察區
  const handleClearActivePool = async () => {
    if (activeItems.length === 0) return;
    const movedIds = activeItems.map((c) => c.id);
    const newActiveIds = [];
    const newStandbyIds = [...standbyItems.map((c) => c.id), ...movedIds];
    const { err } = await reorderCategories(newActiveIds, newStandbyIds);
    if (err) {
      message.error(err.msg || err.message || '清空失敗');
      return;
    }
    message.success(`已將 ${movedIds.length} 個族群移到觀察區`);
  };

  // 點擊 → / ← 一鍵跨 pool（移到對面 pool 的尾端）
  const handleMoveToOtherPool = async (category) => {
    let newActiveIds;
    let newStandbyIds;
    if (category.isStandby) {
      newStandbyIds = standbyItems.filter((c) => c.id !== category.id).map((c) => c.id);
      newActiveIds = [...activeItems.map((c) => c.id), category.id];
    } else {
      newActiveIds = activeItems.filter((c) => c.id !== category.id).map((c) => c.id);
      newStandbyIds = [...standbyItems.map((c) => c.id), category.id];
    }
    const { err } = await reorderCategories(newActiveIds, newStandbyIds);
    if (err) message.error(err.msg || err.message || '切換失敗');
  };

  const findContainerOf = (id) => {
    if (id === POOL_ACTIVE) return POOL_ACTIVE;
    if (id === POOL_STANDBY) return POOL_STANDBY;
    const cat = localList.find((c) => c.id === id);
    if (!cat) return null;
    return cat.isStandby ? POOL_STANDBY : POOL_ACTIVE;
  };

  // ref 用來在 dragEnd 後讀取最新 localList
  const latestListRef = useRef(localList);
  useEffect(() => {
    latestListRef.current = localList;
  }, [localList]);

  // 拖曳期間：跨 container 即時切換 isStandby + 插入到 over 位置
  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const activeCon = findContainerOf(active.id);
    const overCon = findContainerOf(over.id);
    if (!activeCon || !overCon || activeCon === overCon) return;

    setLocalList((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === active.id);
      if (fromIdx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      const moved = { ...item, isStandby: overCon === POOL_STANDBY };

      const toIdx =
        over.id === POOL_ACTIVE || over.id === POOL_STANDBY
          ? next.length
          : next.findIndex((c) => c.id === over.id);
      next.splice(toIdx < 0 ? next.length : toIdx, 0, moved);
      return next;
    });
  };

  // 拖曳結束：同 pool 內 reorder，並把最終結果同步到後端
  const handleDragEnd = async ({ active, over }) => {
    if (!over) return;
    setLocalList((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === active.id);
      const toIdx =
        over.id === POOL_ACTIVE || over.id === POOL_STANDBY
          ? prev.length - 1
          : prev.findIndex((c) => c.id === over.id);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      return arrayMove(prev, fromIdx, toIdx);
    });

    // 等下個 tick 拿到最新 localList，再 commit
    await new Promise((r) => setTimeout(r, 0));
    const latest = latestListRef.current;
    const finalActive = latest.filter((c) => !c.isStandby).map((c) => c.id);
    const finalStandby = latest.filter((c) => c.isStandby).map((c) => c.id);
    const { err } = await reorderCategories(finalActive, finalStandby);
    if (err) message.error(err.msg || err.message || '排序失敗');
  };

  const targetDiff = 1 - totalTargetRatio;
  const targetWarn = totalTargetRatio > 0 && Math.abs(targetDiff) > 0.001;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 完全空狀態 — 罕見（除非把預設全刪光），給個簡單入口
  if (localList.length === 0) {
    return (
      <>
        <div
          style={{
            border: '1px dashed #d9d9d9',
            borderRadius: 4,
            padding: '48px 24px',
            textAlign: 'center',
            background: '#fafafa',
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>還沒有族群</div>
          <div style={{ color: '#888', marginBottom: 20, fontSize: 13 }}>
            點下方按鈕新增第一個族群
          </div>
          <Button
            type="primary"
            size="large"
            className="rounded-sm"
            icon={<PlusOutlined />}
            onClick={() => handleAdd(false)}
          >
            新增族群
          </Button>
        </div>

        <CategoryFormModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
          initialData={editing}
          existingCategories={localList}
          loading={mutating}
        />
      </>
    );
  }

  return (
    <div className="ManageView">
      {/* toolbar */}
      <div className="useBetween" style={{ marginBottom: 12 }}>
        <span style={{ color: '#888', fontSize: 13 }}>
          {localList.length} / {maxCategories} 個族群
          <span style={{ margin: '0 8px' }}>·</span>
          目標 <b>{activeItems.length}</b>
          <span style={{ margin: '0 4px' }}>·</span>
          觀察 <b>{standbyItems.length}</b>
          {activeItems.length > 0 && (
            <>
              <span style={{ margin: '0 8px' }}>·</span>
              目標佔比合計 <b>{(totalTargetRatio * 100).toFixed(1)}%</b>
              {targetWarn && (
                <span style={{ marginLeft: 8, color: '#faad14', fontSize: 12 }}>
                  （{targetDiff > 0 ? '尚差' : '超過'}{' '}
                  {Math.abs(targetDiff * 100).toFixed(1)}%）
                </span>
              )}
            </>
          )}
        </span>
        <Button
          type="primary"
          className="rounded-sm px-lg"
          icon={<PlusOutlined />}
          onClick={() => handleAdd(false)}
          disabled={isAtLimit}
        >
          新增族群
        </Button>
      </div>

      {/* two-pool layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="ManageView-pools">
          <Pool
            poolId={POOL_ACTIVE}
            title="目標"
            subtitle={`${activeItems.length} 個族群`}
            items={activeItems}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateTarget={handleUpdateTarget}
            onMoveToOtherPool={handleMoveToOtherPool}
            onClearAll={handleClearActivePool}
            onAdd={() => handleAdd(false)}
            isAtLimit={isAtLimit}
            mutating={mutating}
            showTarget
          />
          <WatchlistPool
            title="觀察"
            subtitle={`${standbyItems.length} 個族群 · 觀察清單`}
            items={standbyItems}
            onMoveToTarget={handleMoveToOtherPool}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={() => handleAdd(true)}
            isAtLimit={isAtLimit}
          />
        </div>
      </DndContext>

      <CategoryFormModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initialData={editing}
        existingCategories={localList}
        loading={mutating}
      />
    </div>
  );
};

// --- Pool component ---
const Pool = ({
  poolId,
  title,
  subtitle,
  tooltip,
  items,
  onEdit,
  onDelete,
  onUpdateTarget,
  onMoveToOtherPool,
  onClearAll,
  onAdd,
  isAtLimit,
  mutating,
  showTarget,
  background = '#fff',
}) => {
  // useDroppable: 讓空 pool 也能接收 drop
  const { setNodeRef, isOver } = useDroppable({ id: poolId });

  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 4,
        background,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* header (固定) */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoCircleOutlined style={{ color: '#999', fontSize: 13 }} />
          </Tooltip>
        )}
        <span style={{ marginLeft: 'auto', color: '#999', fontSize: 12 }}>{subtitle}</span>
        {onClearAll && items.length > 0 && (
          <Popconfirm
            title="清空目標區？"
            description={`${items.length} 個族群將全部移到觀察區`}
            onConfirm={onClearAll}
            okText="清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="把目標區的族群全部移到觀察區">
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                style={{ color: '#999', marginLeft: 4 }}
              >
                清空
              </Button>
            </Tooltip>
          </Popconfirm>
        )}
      </div>

      {/* scroll area (flex:1) */}
      <SortableContext
        id={poolId}
        items={items.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <PerfectScrollbar
          containerRef={(el) => {
            if (el) setNodeRef(el);
          }}
          style={{
            flex: 1,
            minHeight: 0,
            background: isOver ? '#f0f7ff' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#bbb',
                fontSize: 13,
              }}
            >
              拖曳族群到這裡，或
              <button
                type="button"
                onClick={onAdd}
                disabled={isAtLimit || mutating}
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
            items.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateTarget={onUpdateTarget}
                onMoveToOtherPool={onMoveToOtherPool}
                showTarget={showTarget}
                dimmed={!showTarget}
              />
            ))
          )}
        </PerfectScrollbar>
      </SortableContext>
    </div>
  );
};

// 觀察 pool 包裝（複用 Pool shell，內容換成 WatchlistGroups）
const WatchlistPool = ({
  title,
  subtitle,
  items,
  onMoveToTarget,
  onEdit,
  onDelete,
  onAdd,
  isAtLimit,
}) => {
  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 4,
        background: '#fafafa',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <Tooltip title="觀察族群不計入目標佔比，也不會出現在配置 Tab 的 pie chart 中。點 chip 一鍵移到「目標」。">
          <InfoCircleOutlined style={{ color: '#999', fontSize: 13 }} />
        </Tooltip>
        <span style={{ marginLeft: 'auto', color: '#999', fontSize: 12 }}>{subtitle}</span>
      </div>

      {/* groups */}
      <WatchlistGroups
        poolId={POOL_STANDBY}
        items={items}
        onMoveToTarget={onMoveToTarget}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        isAtLimit={isAtLimit}
      />
    </div>
  );
};

export default ManageView;
