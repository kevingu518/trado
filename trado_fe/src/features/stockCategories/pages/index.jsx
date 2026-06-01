import React, { useState } from 'react';
import { Tabs } from 'antd';
import { useStockCategories } from '../hooks/useStockCategories';
import { useAllocation } from '../hooks/useAllocation';
import AllocationView from '../components/AllocationView';
import ManageView from '../components/ManageView';

const StockCategoriesPage = () => {
  const [activeTab, setActiveTab] = useState('allocation');

  const {
    list,
    loading: catLoading,
    mutating,
    createCategory,
    bulkCreateCategories,
    updateCategory,
    deleteCategory,
    setSymbolCategory,
    refetch: refetchCategories,
    isAtLimit,
    maxCategories,
  } = useStockCategories();

  // 切到「配置」Tab 時才拉資料；切換時也會 refetch（包含 unclassified 重新計算）
  const {
    data: allocationData,
    loading: allocLoading,
    error: allocError,
    refetch: refetchAllocation,
  } = useAllocation(activeTab === 'allocation');

  const refetchBoth = async () => {
    await Promise.all([refetchCategories(), refetchAllocation()]);
  };

  return (
    <div className="h-full w-full overflow-hidden StockCategories">
      <div
        className="card h-full px-md overflow-hidden"
        style={{ position: 'relative', padding: 12, display: 'flex', flexDirection: 'column' }}
      >
        <div className="useBetween" style={{ marginBottom: 4 }}>
          <span className="text-title font-bold font-serif">持股族群</span>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'allocation',
              label: '配置',
              children: (
                <AllocationView
                  data={allocationData}
                  loading={allocLoading}
                  error={allocError}
                  categories={list}
                  setSymbolCategory={setSymbolCategory}
                  onRefetch={refetchBoth}
                />
              ),
            },
            {
              key: 'manage',
              label: '管理',
              children: (
                <ManageView
                  list={list}
                  loading={catLoading}
                  mutating={mutating}
                  isAtLimit={isAtLimit}
                  maxCategories={maxCategories}
                  createCategory={createCategory}
                  updateCategory={updateCategory}
                  bulkCreateCategories={bulkCreateCategories}
                  deleteCategory={deleteCategory}
                />
              ),
            },
          ]}
          style={{ flex: 1, minHeight: 0 }}
        />
      </div>
    </div>
  );
};

export default StockCategoriesPage;
