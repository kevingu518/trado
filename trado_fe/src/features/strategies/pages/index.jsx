import React, { useState } from 'react'
import { Card, Button, Space, Tag, Switch, message, Empty, Spin, Row, Col, Tooltip } from 'antd'
import { PlusOutlined, EyeOutlined } from '@ant-design/icons'
import { to } from 'await-to-js'
import { formatDate } from '@/utils/dateHelper'
import { useStrategies } from '../hooks/useStrategies'
import AddStrategyDrawer from '../components/AddStrategyModal'
import StrategyDrawer from '../components/StrategyDrawer'
import '../styles/index.scss'

const Strategies = () => {
  // -------------------------   variables   ----------------------------
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState(null)
  const [selectedStrategy, setSelectedStrategy] = useState(null)

  const { data, loading, error, refetch, createStrategy, creating, updateStrategy, updating, deleteStrategy, isAtLimit, strategyCount, maxStrategies } = useStrategies()

  // -------------------------   functions   ----------------------------
  const handleAddStrategy = async (values) => {
    const { err } = await createStrategy(values)

    if (err) {
      message.error(err.message || err.msg || '新增策略失敗')
      return
    }

    message.success('新增策略成功')
    setAddModalVisible(false)
  }

  const handleEditStrategy = async (values) => {
    if (!editingStrategy) return

    const [err, result] = await to(updateStrategy(editingStrategy.id, values))
    
    if (err) {
      message.error(err.msg || '更新策略失敗')
      return
    }
    
    message.success('更新策略成功')
    setAddModalVisible(false)
    setEditingStrategy(null)
  }

  const handleDeleteStrategy = async (strategyId) => {
    const [err, result] = await to(deleteStrategy(strategyId))
    
    if (err) {
      message.error(err.msg || '刪除策略失敗')
      return
    }
    
    message.success('刪除策略成功')
    setDrawerVisible(false)
    setSelectedStrategy(null)
  }

  const handleToggleActive = async (strategy, checked) => {
    const [err, result] = await to(updateStrategy(strategy.id, { ...strategy, isActive: checked }))
    
    if (err) {
      message.error(err.msg || '更新策略狀態失敗')
      return
    }
    
    message.success(checked ? '策略已啟用' : '策略已停用')
  }

  const handleViewStrategy = (strategy) => {
    setSelectedStrategy(strategy)
    setDrawerVisible(true)
  }

  const handleOpenAddModal = () => {
    setEditingStrategy(null)
    setAddModalVisible(true)
  }

  const handleOpenEditModal = (strategy) => {
    setEditingStrategy(strategy)
    setAddModalVisible(true)
    setDrawerVisible(false)
  }

  const categoryMap = {
    'TREND_FOLLOWING': { label: '趨勢跟隨', color: 'blue' },
    'CONTRARIAN': { label: '逆勢策略', color: 'green' },
    'DAY_TRADING': { label: '當沖交易', color: 'orange' },
    'DIVIDEND_INVESTING': { label: '股息投資', color: 'purple' },
    // 保留舊的 type 對應（向後兼容）
    'trend': { label: '趨勢策略', color: 'blue' },
    'mean-reversion': { label: '均值回歸', color: 'green' },
    'arbitrage': { label: '套利策略', color: 'orange' },
    'momentum': { label: '動量策略', color: 'purple' },
    'other': { label: '其他', color: 'default' },
  }

  // -------------------------   render   ----------------------------
  const strategiesList = data?.list || []

  return (
    <div className="Strategies">
      {/* 標題區 */}
      <div className="card h-full p-none overflow-hidden" style={{ position: 'relative', padding: '8px 12px' }}>
        <div className="useBetween">
          <div>
            <span className='text-title font-bold font-serif'>策略管理</span>
          </div>
          <Tooltip title={isAtLimit ? `策略數量已達上限 (${maxStrategies})` : ''}>
            <span className="strategy-count-hint text-hint" style={{ marginRight: 8 }}>
              {strategyCount} / {maxStrategies}
            </span>
            <Button
              type="primary"
              className='rounded-sm px-lg'
              icon={<PlusOutlined />}
              onClick={handleOpenAddModal}
              size="middle"
              disabled={isAtLimit}
            >
              新增策略
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 策略列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty description="載入策略失敗，請稍後再試" />
        </div>
      ) : strategiesList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty description="尚無策略，點擊「新增策略」開始建立" />
        </div>
      ) : (
        <Row gutter={[16, 16]} className="Strategies-list">
          {strategiesList.map((strategy) => (
            <Col xs={24} sm={12} md={12} lg={6} key={strategy.id}>
              <Card
                className={`Strategies-card ${!strategy.isActive ? 'inactive' : ''}`}
                hoverable
                actions={[
                  <Switch
                    key="switch"
                    checked={strategy.isActive}
                    onChange={(checked) => handleToggleActive(strategy, checked)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    className="my-base"
                  />,
                  <Button
                    key="view"
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewStrategy(strategy)
                    }}
                  >
                    查看
                  </Button>,
                ]}
                onClick={() => handleViewStrategy(strategy)}
              >
                <div className="Strategies-card-content">
                  {/* header */}
                  <div className="Strategies-card-header">
                    <h3 className="Strategies-card-title">{strategy.name}</h3>
                    <Tag 
                      className="mr-none"
                      color={categoryMap[strategy.category || strategy.type]?.color || 'default'}>
                      {categoryMap[strategy.category || strategy.type]?.label || strategy.category || strategy.type}
                    </Tag>
                  </div>
                  {/* start date */}
                  <div className="Strategies-card-date my-sm text-hint">
                    <span className="text-grey-400 font-pf">開始日期：{formatDate(strategy.createdAt) || '-'}</span>
                  </div>
                  {/* stats */}
                  <div className="Strategies-card-stats">
                    {/* 第一行：交易數、勝率 */}
                    <div className="stat-row">
                      <div className="stat-item">
                        <span className="stat-label">交易數</span>
                        <span className="stat-value">{strategy.stats?.totalTrades ?? 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">勝率</span>
                        <span className="stat-value">
                          {strategy.stats?.winRate !== null && strategy.stats?.winRate !== undefined
                            ? `${(strategy.stats.winRate * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>
                    {/* 第二行：獲利交易數、虧損交易數 */}
                    <div className="stat-row">
                      <div className="stat-item">
                        <span className="stat-label">獲利交易數</span>
                        <span className="stat-value">{strategy.stats?.winningTrades ?? strategy.stats?.profitTrades ?? 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">虧損交易數</span>
                        <span className="stat-value">{strategy.stats?.losingTrades ?? strategy.stats?.lossTrades ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 新增/編輯 Drawer */}
      <AddStrategyDrawer
        visible={addModalVisible}
        onClose={() => {
          setAddModalVisible(false)
          setEditingStrategy(null)
        }}
        onSubmit={editingStrategy ? handleEditStrategy : handleAddStrategy}
        initialData={editingStrategy}
        loading={creating || updating}
      />

      {/* 詳情 Drawer */}
      <StrategyDrawer
        visible={drawerVisible}
        onClose={() => {
          setDrawerVisible(false)
          setSelectedStrategy(null)
        }}
        strategyData={selectedStrategy}
        onEdit={handleOpenEditModal}
        onDelete={handleDeleteStrategy}
        getContainer={false}
      />
    </div>
  )
}

export default Strategies
