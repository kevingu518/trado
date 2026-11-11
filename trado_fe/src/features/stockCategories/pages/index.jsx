import React, { useState } from 'react';
import { Tabs } from 'antd';
import { useStockCategories } from '../hooks/useStockCategories';
import { useAllocation } from '../hooks/useAllocation';
import AllocationView from '../components/AllocationView';
import ManageView from '../components/ManageView';
import CategoryFlowView from '../components/CategoryFlowView';
import '../styles/index.scss';

const StockCategoriesPage = () => {
  const [activeTab, setActiveTab] = useState('allocation');

  const {
    list,
    loading: catLoading,
    mutating,
    createCategory,
    reorderCategories,
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
          className="StockCategories-tabs"
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
              key: 'flow',
              label: '資金流向',
              children: <CategoryFlowView />,
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
                  reorderCategories={reorderCategories}
                  deleteCategory={deleteCategory}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default StockCategoriesPage;
