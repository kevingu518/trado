import React, { useState, useMemo } from 'react'
import { Card, Button, Tag, Switch, message, Empty, Spin, Row, Col, Tooltip, Select, Segmented } from 'antd'
import { PlusOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { to } from 'await-to-js'
import { formatDate } from '@/utils/dateHelper'
import { useTheme } from '@/contexts/ThemeContext'
import { useStrategies } from '../hooks/useStrategies'
import AddStrategyDrawer from '../components/AddStrategyModal'
import StrategyDrawer from '../components/StrategyDrawer'
import '../styles/index.scss'

const { Option } = Select

const CATEGORY_MAP = {
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

const NEW_CATEGORY_KEYS = ['TREND_FOLLOWING', 'CONTRARIAN', 'DAY_TRADING', 'DIVIDEND_INVESTING']

const CATEGORY_OPTIONS = NEW_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: CATEGORY_MAP[key].label,
}))

const Strategies = () => {
  // -------------------------   variables   ----------------------------
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState(null)
  const [selectedStrategy, setSelectedStrategy] = useState(null)

  // filter / sort state
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all') // all | active | inactive
  const [sortBy, setSortBy] = useState('createdAt-desc')

  const { theme } = useTheme()
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

  // -------------------------   render   ----------------------------
  const strategiesList = useMemo(() => data?.list || [], [data])

  // 頁面級彙總(所有策略,不受 filter 影響；系統「未分類」策略不列入上限統計)
  const summary = useMemo(() => {
    const userStrategies = strategiesList.filter((s) => !s.isSystem)
    const total = userStrategies.length
    const activeCount = userStrategies.filter((s) => s.isActive).length
    const totalTrades = strategiesList.reduce((sum, s) => sum + (s.stats?.totalTrades ?? 0), 0)
    const weightedWinRate = (() => {
      const weighted = strategiesList.reduce(
        (acc, s) => {
          const trades = s.stats?.totalTrades ?? 0
          const winRate = s.stats?.winRate ?? 0
          if (!trades) return acc
          acc.weightSum += trades
          acc.rateSum += winRate * trades
          return acc
        },
        { weightSum: 0, rateSum: 0 }
      )
      return weighted.weightSum > 0 ? weighted.rateSum / weighted.weightSum : null
    })()
    return { total, activeCount, totalTrades, weightedWinRate }
  }, [strategiesList])

  // 過濾 + 排序(客戶端)
  const displayList = useMemo(() => {
    let list = [...strategiesList]
    if (categoryFilter) {
      list = list.filter((s) => (s.category || s.type) === categoryFilter)
    }
    if (activeFilter === 'active') list = list.filter((s) => s.isActive)
    if (activeFilter === 'inactive') list = list.filter((s) => !s.isActive)

    const [key, order] = sortBy.split('-')
    const dir = order === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let va
      let vb
      if (key === 'createdAt') {
        va = new Date(a.createdAt || 0).getTime()
        vb = new Date(b.createdAt || 0).getTime()
      } else if (key === 'winRate') {
        va = a.stats?.winRate ?? 0
        vb = b.stats?.winRate ?? 0
      } else if (key === 'totalTrades') {
        va = a.stats?.totalTrades ?? 0
        vb = b.stats?.totalTrades ?? 0
      } else {
        return 0
      }
      return (va - vb) * dir
    })
    return list
  }, [strategiesList, categoryFilter, activeFilter, sortBy])

  const hasFilters = categoryFilter !== null || activeFilter !== 'all' || sortBy !== 'createdAt-desc'
  const handleResetFilters = () => {
    setCategoryFilter(null)
    setActiveFilter('all')
    setSortBy('createdAt-desc')
  }

  return (
    <div className="Strategies">
      {/* 標題 + 摘要（單列） */}
      <div className="Strategies-header">
        <span className='text-title font-bold font-serif Strategies-header-title'>策略管理</span>
        <div className="Strategies-header-summary">
          <span>策略 <b>{summary.total}</b><span className="Strategies-stat-suffix">/{maxStrategies}</span></span>
          <span className="dot">·</span>
          <span>啟用 <b>{summary.activeCount}</b></span>
        </div>
      </div>

      {/* filter toolbar */}
      <div className="Strategies-toolbar">
        <div className="Strategies-toolbar-filters">
          <Select
            className="rounded-sm"
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="分類"
            allowClear
            style={{ width: 140 }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
          <Segmented
            className="rounded-sm"
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '啟用中', value: 'active' },
              { label: '停用中', value: 'inactive' },
            ]}
          />
          <Select
            className="rounded-sm"
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 160 }}
          >
            <Option value="createdAt-desc">最新建立</Option>
            <Option value="createdAt-asc">最早建立</Option>
            <Option value="winRate-desc">最高勝率</Option>
            <Option value="totalTrades-desc">最多交易數</Option>
          </Select>
          {hasFilters && (
            <Tooltip title="清除篩選">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleResetFilters}
                className="reset-filter-btn"
              />
            </Tooltip>
          )}
        </div>
        <span className="Strategies-toolbar-count">
          顯示 <b>{displayList.length}</b> / {strategiesList.length}
        </span>
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
        <Row gutter={[16, 16]} className="Strategies-list">
          <Col xs={24} sm={12} md={12} lg={8} xl={6}>
            <div
              className="Strategies-ghost-card"
              style={{ '--ghost-primary': theme.primary, '--ghost-primary-dark': theme.primaryDark }}
              onClick={handleOpenAddModal}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenAddModal()
                }
              }}
            >
              <PlusOutlined className="Strategies-ghost-icon" />
              <span className="Strategies-ghost-label">新增策略</span>
              <span className="Strategies-ghost-hint">還可建立 {maxStrategies - strategyCount} 個</span>
            </div>
          </Col>
        </Row>
      ) : displayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty description="沒有符合條件的策略，試試調整篩選" />
        </div>
      ) : (
        <Row gutter={[16, 16]} className="Strategies-list">
          {displayList.map((strategy) => (
            <Col xs={24} sm={12} md={12} lg={8} xl={6} key={strategy.id}>
              <Card
                className={`Strategies-card ${!strategy.isActive ? 'inactive' : ''}`}
                hoverable
                actions={[
                  strategy.isSystem ? (
                    <Tag key="system" color="default" className="my-base">系統</Tag>
                  ) : (
                    <Switch
                      key="switch"
                      checked={strategy.isActive}
                      onChange={(checked) => handleToggleActive(strategy, checked)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                      className="my-base"
                    />
                  ),
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
                      color={strategy.isSystem ? 'default' : (CATEGORY_MAP[strategy.category || strategy.type]?.color || 'default')}>
                      {strategy.isSystem ? '雜項' : (CATEGORY_MAP[strategy.category || strategy.type]?.label || strategy.category || strategy.type)}
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
          {!isAtLimit && (
            <Col xs={24} sm={12} md={12} lg={8} xl={6}>
              <div
                className="Strategies-ghost-card"
                style={{ '--ghost-primary': theme.primary, '--ghost-primary-dark': theme.primaryDark }}
                onClick={handleOpenAddModal}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpenAddModal()
                  }
                }}
              >
                <PlusOutlined className="Strategies-ghost-icon" />
                <span className="Strategies-ghost-label">新增策略</span>
                <span className="Strategies-ghost-hint">還可建立 {maxStrategies - strategyCount} 個</span>
              </div>
            </Col>
          )}
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
