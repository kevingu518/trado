import React, { useState, useMemo } from 'react';
import { Button, Tag, Table, Popconfirm, Spin, message, Tooltip, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';
import CategoryFormModal from './CategoryFormModal';
import QuickSetupModal from './QuickSetupModal';
import TargetRatioInlineEditor from './TargetRatioInlineEditor';

/**
 * 管理 Tab：CRUD（族群名稱、顏色、目標佔比 inline 編輯）
 */
const ManageView = ({
  list,
  loading,
  mutating,
  isAtLimit,
  maxCategories,
  createCategory,
  updateCategory,
  bulkCreateCategories,
  deleteCategory,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [quickSetupVisible, setQuickSetupVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const totalTargetRatio = useMemo(
    () => list.reduce((sum, c) => sum + (c.targetRatio || 0), 0),
    [list],
  );

  const handleAdd = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    setModalVisible(true);
  };

  const handleSubmit = async (payload) => {
    const op = editing
      ? updateCategory(editing.id, payload)
      : createCategory(payload);
    const { err } = await op;
    if (err) {
      message.error(err.msg || err.message || '操作失敗');
      return;
    }
    message.success(editing ? '已更新' : '已新增');
    setModalVisible(false);
    setEditing(null);
  };

  const handleQuickSetup = async (items) => {
    const { err, result } = await bulkCreateCategories(items);
    if (err) {
      message.error(err.msg || err.message || '建立失敗');
      return;
    }
    message.success(`已建立 ${result?.length ?? items.length} 個族群`);
    setQuickSetupVisible(false);
  };

  const handleDelete = async (record) => {
    const { err } = await deleteCategory(record.id);
    if (err) {
      message.error(err.msg || err.message || '刪除失敗');
      return;
    }
    message.success('已刪除');
  };

  const handleUpdateTarget = (record) => async (newRatio) => {
    return await updateCategory(record.id, { targetRatio: newRatio });
  };

  const columns = [
    {
      title: '族群',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Tag color={record.color} style={{ margin: 0, padding: '1px 10px', borderRadius: 4 }}>
          {name}
        </Tag>
      ),
    },
    {
      title: '持股檔數',
      dataIndex: 'symbolCount',
      key: 'symbolCount',
      width: 110,
      align: 'right',
      render: (count) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: count > 0 ? 'inherit' : '#bbb' }}>
          {count}
        </span>
      ),
    },
    {
      title: (
        <Tooltip title="佔總資產（含現金）的目標比例。點擊數字即可編輯。">
          <span style={{ borderBottom: '1px dotted #ccc', cursor: 'help' }}>目標佔比</span>
        </Tooltip>
      ),
      dataIndex: 'targetRatio',
      key: 'targetRatio',
      width: 140,
      align: 'right',
      render: (r, record) => (
        <TargetRatioInlineEditor value={r} onChange={handleUpdateTarget(record)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="編輯名稱 / 顏色">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="確定刪除此族群？"
            description={
              record.symbolCount > 0
                ? `${record.symbolCount} 檔持股將取消歸類`
                : '此族群尚未歸類任何持股'
            }
            onConfirm={() => handleDelete(record)}
            okText="刪除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="刪除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* toolbar */}
      <div className="useBetween" style={{ marginBottom: 12 }}>
        <span style={{ color: '#888', fontSize: 13 }}>
          {list.length} / {maxCategories} 個族群
          {list.length > 0 && (
            <>
              <span style={{ margin: '0 8px' }}>·</span>
              目標佔比合計 <b>{(totalTargetRatio * 100).toFixed(1)}%</b>
              {Math.abs(totalTargetRatio - 1) > 0.001 && totalTargetRatio > 0 && (
                <span style={{ marginLeft: 8, color: '#faad14', fontSize: 12 }}>
                  （{totalTargetRatio < 1 ? '尚差' : '超過'}{' '}
                  {Math.abs((1 - totalTargetRatio) * 100).toFixed(1)}% 達到 100%）
                </span>
              )}
            </>
          )}
        </span>
        <Space>
          {list.length > 0 && (
            <Button
              className="rounded-sm"
              icon={<ThunderboltOutlined />}
              onClick={() => setQuickSetupVisible(true)}
              disabled={isAtLimit}
            >
              從範本加入
            </Button>
          )}
          <Button
            type="primary"
            className="rounded-sm px-lg"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            disabled={isAtLimit}
          >
            新增族群
          </Button>
        </Space>
      </div>

      {/* table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : list.length === 0 ? (
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
            從預設的台股次產業範本快速建立，之後也可以自由編輯
          </div>
          <Space>
            <Button
              type="primary"
              size="large"
              className="rounded-sm"
              icon={<ThunderboltOutlined />}
              onClick={() => setQuickSetupVisible(true)}
            >
              從範本快速建立
            </Button>
            <Button
              size="large"
              className="rounded-sm"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              自訂新增
            </Button>
          </Space>
        </div>
      ) : (
        <PerfectScrollbar className="bg-white" style={{ maxHeight: 'calc(100vh - 240px)' }}>
          <Table
            rowKey="id"
            size="small"
            dataSource={list}
            columns={columns}
            pagination={false}
            sticky
            tableLayout="auto"
          />
        </PerfectScrollbar>
      )}

      <CategoryFormModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initialData={editing}
        existingCategories={list}
        loading={mutating}
      />

      <QuickSetupModal
        visible={quickSetupVisible}
        onClose={() => setQuickSetupVisible(false)}
        onConfirm={handleQuickSetup}
        loading={mutating}
      />
    </>
  );
};

export default ManageView;
