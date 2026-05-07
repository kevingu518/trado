// src/pages/Transactions/index.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react'
import dayjs from 'dayjs'

import { Table, Tag, Button, Space, message, Card, Row, Col, Switch, Rate, Tooltip, DatePicker, Select, Input, Pagination, Tabs, Statistic, Dropdown } from 'antd'

const { Option } = Select;
const { TabPane } = Tabs;
import { EllipsisOutlined,EditOutlined, EyeOutlined, PlusOutlined, CheckOutlined, CloseOutlined, MinusOutlined, FileTextOutlined, ClockCircleOutlined, DollarOutlined, ClearOutlined, ToolOutlined} from '@ant-design/icons'
import PerfectScrollbar from 'react-perfect-scrollbar'
import 'react-perfect-scrollbar/dist/css/styles.css';
import { to } from 'await-to-js'

import { useTrades } from '../hooks/useTrades'
import { tradesService } from '../services/trades'
import { positionsService } from '../services/positions'
import { useShortcut } from '@/shortcuts'

import AddTradeModal from '../components/AddTradeModal'
import AddPositionModal from '../components/AddPositionModal'
import TradeDrawer from '../components/TradeDrawer'
import KLineChart from '../components/KLineChart'

const { RangePicker } = DatePicker;

const Transactions = () => {
  // -------------------------   variables   ----------------------------
  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()
  const CLR_NONE = '#666'
  const pnlColor = (v) => v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE

  // 新增過濾器狀態（使用後端命名）
  // Filter states
  const [dateRange, setDateRange] = useState(null) // 時間範圍
  const [symbolInput, setSymbolInput] = useState('') // 股票輸入值
  const [symbolFilter, setSymbolFilter] = useState(null) // 股票號碼（debounced，送 API）
  const [directionFilter, setDirectionFilter] = useState(null) // 多空方向
  const [statusFilter, setStatusFilter] = useState('all') // 交易狀態
  const [strategyFilter, setStrategyFilter] = useState(null) // 策略

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [addPositionModalVisible, setAddPositionModalVisible] = useState(false)
  const [addTradeModalVisible, setAddTradeModalVisible] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null) // 正在編輯的交易資料
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (total, range) =>
      `第 ${range[0]}-${range[1]} 項，共 ${total} 項`,
  })

  // 股號輸入框 ref（供「/」快捷鍵 focus）
  const symbolInputRef = useRef(null)

  // 搜尋股票：按 Enter 或清空時才送 API
  const handleSymbolSearch = () => {
    const val = symbolInput.length >= 2 ? symbolInput : null
    setSymbolFilter(val)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  // 清除所有過濾條件（給「清除」按鈕與「r」快捷鍵共用）
  const handleResetFilters = () => {
    setDateRange(null)
    setSymbolInput('')
    setSymbolFilter(null)
    setStrategyFilter(null)
    setDirectionFilter(null)
    setStatusFilter('all')
  }

  // 快捷鍵：n 開單 / / focus 股號搜尋 / r 清除過濾 / s 切換狀態
  useShortcut('trades-new', () => handleAdd())
  useShortcut('trades-search', () => symbolInputRef.current?.focus())
  useShortcut('trades-reset', () => handleResetFilters())
  useShortcut('trades-status-cycle', () => {
    // 用 functional setState 讀最新值，避免閉包過期
    setStatusFilter((prev) => {
      const order = ['all', 'open', 'completed']
      const idx = order.indexOf(prev)
      return order[(idx + 1) % order.length]
    })
  })

  // -------------------------   hooks   ----------------------------
  // 使用 useTrades hook 取得交易資料
  const { 
    data: tradesData, 
    loading: tradesLoading, 
    error: tradesError, 
    refetch: refetchTrades,
    createTrade,
    creating: creatingTrade,
    updateTrade,
    updating: updatingTrade
  } = useTrades({
    page: pagination.current,
    pageSize: pagination.pageSize,
    startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
    symbol: symbolFilter,
    direction: directionFilter,
    status: statusFilter === 'all' ? undefined : statusFilter === 'completed' ? 'closed' : statusFilter,
    strategy: strategyFilter,
  })
  // 從 tradesData 取得要顯示的資料
  const displayData = useMemo(() => {
    if (!tradesData) return []
    // 如果 API 返回的資料格式是 { list, total, page, pageSize }
    if (tradesData.list) return tradesData.list
    // 如果 API 直接返回陣列
    if (Array.isArray(tradesData)) return tradesData
    return []
  }, [tradesData])

  // 當 API 資料載入成功時，更新 pagination
  useEffect(() => {
    if (tradesData) {
      // 如果 API 返回的資料格式是 { list, total, page, pageSize }
      if (tradesData.list && Array.isArray(tradesData.list)) {
        setPagination(prev => ({
          ...prev,
          total: tradesData.total || tradesData.list.length, // 如果沒有 total，使用 list.length
          current: tradesData.page || prev.current,
          pageSize: tradesData.pageSize || prev.pageSize,
        }))
      } 
      // 如果 API 直接返回陣列
      else if (Array.isArray(tradesData)) {
        setPagination(prev => ({
          ...prev,
          total: tradesData.length, // 使用陣列長度作為 total
          // current 和 pageSize 保持不變
        }))
      }
    } else {
      // 如果沒有資料，重置 total
      setPagination(prev => ({
        ...prev,
        total: 0,
      }))
    }
  }, [tradesData])

  // 處理 API 錯誤
  useEffect(() => {
    if (tradesError) {
      console.error('取得交易資料失敗:', tradesError)
      message.error(tradesError.msg || '取得交易資料失敗')
    }
  }, [tradesError])

  // -------------------------   configs   ----------------------------
  // 錯誤分類選項（對應後端 ErrorCategory enum）
  const errorCategories = [
    { value: 'ENTRY_TIMING', label: '進場時機錯誤' },
    { value: 'EXIT_TIMING', label: '出場時機錯誤' },
    { value: 'POSITION_SIZE', label: '部位大小錯誤' },
    { value: 'EMOTION_CONTROL', label: '情緒控制問題' },
    { value: 'STRATEGY_DEVIATION', label: '偏離策略' },
    { value: 'RISK_MANAGEMENT', label: '風險管理不當' },
    { value: 'MARKET_ANALYSIS', label: '市場分析錯誤' },
    { value: 'OTHER', label: '其他' }
  ]

  // 情緒選項（對應後端 Emotion enum）
  const emotions = [
    { value: 'CALM', label: '冷靜', color: '#1890ff' },
    { value: 'ANXIOUS', label: '焦慮', color: '#faad14' },
    { value: 'EXCITED', label: '興奮', color: '#eb2f96' },
    { value: 'FEARFUL', label: '恐懼', color: CLR_DOWN },
    { value: 'GREEDY', label: '貪婪', color: '#ff7a45' },
    { value: 'CONFIDENT', label: '自信', color: CLR_UP },
    { value: 'DOUBTFUL', label: '懷疑', color: '#fa8c16' },
    { value: 'FRUSTRATED', label: '挫折', color: '#722ed1' },
    { value: 'IMPATIENT', label: '不耐煩', color: '#f5222d' },
    { value: 'NEUTRAL', label: '中性', color: '#8c8c8c' }
  ]
  // -------------------------   functions   ----------------------------
  // 處理新增交易 - 彈出新增 trade modal
  const handleAdd = () => {
    setAddTradeModalVisible(true)
  }

  // 處理新增 trade（可選同時建立倉位）
  const handleAddTrade = async (tradeData, positionData = null) => {
    try {
      // 準備 API payload（使用前端格式，DTO 會自動轉換）
      const payload = {
        symbol: tradeData.symbol,
        direction: tradeData.direction, // "long" 或 "short"
        status: 'open', // 新增時預設為 open
        followedDiscipline: 'pending', // 新增時預設為 pending
        strategyId: tradeData.strategyId || null,
        createdAt: tradeData.createdAt, // 已經是 YYYY-MM-DD 格式
        closedAt: tradeData.closedAt || null,
        note: tradeData.note || null,
      }

      // 使用 hook 的 createTrade 方法
      const { err: error, result } = await createTrade(payload)

      if (error) {
        message.error(error.msg || error.message || '新增交易記錄失敗')
        return
      }

      // 如果有倉位資料，接著建立倉位
      if (positionData && result?.id) {
        const [posErr] = await to(positionsService.addPosition(result.id, positionData))
        if (posErr) {
          message.warning('交易已新增，但倉位建立失敗：' + (posErr.msg || posErr.message || '未知錯誤'))
          return
        }
        await refetchTrades()
      }

      message.success(positionData ? '交易記錄與倉位已新增' : '交易記錄已新增')
    } catch (err) {
      console.error('新增交易記錄失敗:', err)
      message.error('新增交易記錄失敗，請稍後再試')
    }
  }

  // 處理編輯交易 - 彈出編輯 trade modal
  const handleEditTrade = (record) => {
    setEditingTrade(record)
    setAddTradeModalVisible(true)
  }

  // 處理保存 trade（用於 Modal 的 onSave，支援新增和編輯）
  const handleSaveTrade = async (tradeIdOrData, tradeDataOrPosition) => {
    try {
      // 判斷是編輯模式還是新增模式
      if (typeof tradeIdOrData === 'string' || typeof tradeIdOrData === 'number') {
        // 編輯模式：第一個參數是 tradeId，第二個是要更新的欄位
        const { err } = await updateTrade(tradeIdOrData, tradeDataOrPosition)
        if (err) {
          message.error(err.msg || err.message || '更新交易記錄失敗')
          return
        }
        message.success('交易記錄已更新')
      } else {
        // 新增模式：第一個參數是 tradeData，第二個是 positionData（可選）
        await handleAddTrade(tradeIdOrData, tradeDataOrPosition)
      }
    } catch (err) {
      console.error('保存交易記錄失敗:', err)
      message.error('保存交易記錄失敗，請稍後再試')
    }
  }

  // 處理新增倉位 - 彈出新增倉位 modal
  const handleOpenAddPositionModal = (recordOrTradeId) => {
    // 如果傳入的是 tradeId（從 TradeDrawer），需要找到對應的 record
    if (typeof recordOrTradeId === 'string' || typeof recordOrTradeId === 'number') {
      // 從 tradesData 中找到對應的交易記錄
      const tradeRecord = tradesData?.list?.find(t => t.id === recordOrTradeId || t.id === String(recordOrTradeId)) || 
                          tradesData?.find(t => t.id === recordOrTradeId || t.id === String(recordOrTradeId))
      if (tradeRecord) {
        setSelectedRecord(tradeRecord)
        setAddPositionModalVisible(true)
      } else {
        // 如果找不到記錄，但 drawer 是打開的且當前 selectedRecord 的 id 匹配
        if (drawerVisible && selectedRecord && (selectedRecord.id === recordOrTradeId || selectedRecord.id === String(recordOrTradeId))) {
          // 使用現有的 selectedRecord，不要覆蓋
          setAddPositionModalVisible(true)
        } else {
          // 如果找不到記錄，直接使用 tradeId（AddPositionModal 會處理）
          setSelectedRecord({ id: recordOrTradeId })
          setAddPositionModalVisible(true)
        }
      }
    } else {
      // 如果傳入的是 record 物件
      setSelectedRecord(recordOrTradeId)
      setAddPositionModalVisible(true)
    }
  }

  // 處理查看詳情
  const handleView = (record) => {
    setSelectedRecord(record)
    setDrawerVisible(true)
  }

  // 取得 tradeId（從 selectedRecord 或直接使用）
  const tradeId = selectedRecord?.id || null

  // 關閉 drawer
  const handleCloseDrawer = () => {
    setDrawerVisible(false)
    setSelectedRecord(null)
  }

  // 關閉新增倉位 modal
  const handleCloseAddPositionModal = () => {
    setAddPositionModalVisible(false)
    // 不要立即清空 selectedRecord，因為可能還在 drawer 中
    // 只有在 drawer 關閉時才清空
    // setSelectedRecord(null)
  }

  // 關閉新增/編輯 trade modal
  const handleCloseAddTradeModal = () => {
    setAddTradeModalVisible(false)
    setEditingTrade(null)
  }

  // 保存檢討
  const handleSaveReview = async (tradeId, reviewData) => {
    try {
      if (!tradeId) {
        message.error('交易 ID 不存在')
        return
      }

      // 只發送有值的欄位（過濾掉 undefined）
      const payload = {}
      if (reviewData.reviewNotes !== undefined) payload.reviewNotes = reviewData.reviewNotes
      if (reviewData.errorCategory !== undefined) payload.errorCategory = reviewData.errorCategory
      if (reviewData.emotion !== undefined) payload.emotion = reviewData.emotion
      if (reviewData.followedDiscipline !== undefined) payload.followedDiscipline = reviewData.followedDiscipline
      if (reviewData.selfRating !== undefined) payload.selfRating = reviewData.selfRating

      // 調用 service 層的 editTrade 更新檢討內容
      const [error, result] = await to(tradesService.editTrade(tradeId, payload))

      if (error) {
        message.error(error.msg || error.message || '保存檢討失敗')
        return
      }

      message.success('檢討內容已保存')
      // 重新載入交易列表
      await refetchTrades()
    } catch (error) {
      console.error('保存失敗:', error)
      message.error('保存失敗，請檢查輸入內容')
    }
  }

  // 使用 ref 來存儲 TradeDrawer 的刷新函數
  const onPositionAddedRef = useRef(null)

  // 添加倉位記錄
  const handleAddPositionToTrade = async (tradeId, positionData) => {
    try {
      if (!tradeId) {
        message.error('交易 ID 不存在')
        return
      }

      // 使用 positionsService 新增倉位
      const [error, result] = await to(positionsService.addPosition(tradeId, positionData))

      if (error) {
        message.error(error.msg || error.message || '新增倉位失敗')
        return
      }

      message.success('倉位記錄已添加')
      
      // 重新載入交易列表以確保資料一致性
      await refetchTrades()
      
      // 如果 drawer 是打開的且當前 tradeId 匹配，觸發 TradeDrawer 刷新
      if (drawerVisible && (selectedRecord?.id === tradeId || tradeId === selectedRecord?.id)) {
        // 通知 TradeDrawer 刷新資料
        if (onPositionAddedRef.current) {
          onPositionAddedRef.current()
        }
        // 更新 selectedRecord 以確保資料是最新的（從 refetchTrades 後的資料中獲取）
        // 但不要清空，因為可能還要繼續新增
      }
    } catch (err) {
      console.error('新增倉位失敗:', err)
      message.error('新增倉位失敗，請稍後再試')
    }
  }

  // 編輯倉位記錄
  const handleEditPosition = async (tradeId, positionId, positionData) => {
    try {
      if (!tradeId || !positionId) {
        message.error('交易 ID 或倉位 ID 不存在')
        return
      }

      // 使用 positionsService 更新倉位
      const [error, result] = await to(positionsService.editPosition(tradeId, positionId, positionData))

      if (error) {
        message.error(error.msg || error.message || '更新倉位失敗')
        return
      }

      message.success('倉位記錄已更新')
      
      // 重新載入交易列表以確保資料一致性
      await refetchTrades()
      
      // 如果 drawer 是打開的且當前 tradeId 匹配，觸發 TradeDrawer 刷新
      if (drawerVisible && selectedRecord?.id === tradeId) {
        if (onPositionAddedRef.current) {
          onPositionAddedRef.current()
        }
      }
    } catch (err) {
      console.error('更新倉位失敗:', err)
      message.error('更新倉位失敗，請稍後再試')
    }
  }
  // 分頁
  const handlePagination = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize
    }))
  }

  // 刪除倉位記錄
  const handleDeletePosition = async (tradeId, positionId) => {
    try {
      if (!tradeId || !positionId) {
        message.error('交易 ID 或倉位 ID 不存在')
        return
      }

      // 使用 positionsService 刪除倉位
      const [error, result] = await to(positionsService.removePosition(tradeId, positionId))

      if (error) {
        message.error(error.msg || error.message || '刪除倉位失敗')
        return
      }

      message.success('倉位記錄已刪除')
      
      // 重新載入交易列表以確保資料一致性
      await refetchTrades()
      
      // 如果 drawer 是打開的且當前 tradeId 匹配，觸發 TradeDrawer 刷新
      if (drawerVisible && selectedRecord?.id === tradeId) {
        if (onPositionAddedRef.current) {
          onPositionAddedRef.current()
        }
      }
    } catch (err) {
      console.error('刪除倉位失敗:', err)
      message.error('刪除倉位失敗，請稍後再試')
    }
  }

  // 刪除整筆交易
  const handleDeleteTrade = async (id) => {
    const tradeIdToDelete = id || tradeId

    if (!tradeIdToDelete) {
      message.error('交易 ID 不存在')
      return
    }

    const [err] = await to(tradesService.removeTrade(tradeIdToDelete))

    if (err) {
      message.error(err.msg || err.message || '刪除交易失敗')
      return
    }

    message.success('交易已刪除')

    // 關閉 Drawer，清空選取並刷新列表
    setDrawerVisible(false)
    setSelectedRecord(null)
    await refetchTrades()
  }

  // 處理行展開
  const handleExpand = (expanded, record) => {
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, record.key])
    } else {
      setExpandedRowKeys(expandedRowKeys.filter(key => key !== record.key))
    }
  }

  // 修改展開內容組件
  const expandedRowRender = (record) => {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }} className='expandedRow Transactions-expandedRow'>
        <Tabs defaultActiveKey="positions" size="small">
          <TabPane tab="倉位記錄" key="positions">
            <Table
              className='my-sm'
              rowClassName=""
              columns={[
                { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
                { 
                  title: '動作', 
                  dataIndex: 'action', 
                  key: 'action', 
                  width: 80,
                  render: (action) => (
                    <Tag color={action === 'buy' ? 'green' : 'red'}>
                      {action === 'buy' ? '買入' : '賣出'}
                    </Tag>
                  )
                },
                { 
                  title: '價格', 
                  dataIndex: 'price', 
                  key: 'price', 
                  width: 100,
                  render: (price) => `$${price}`
                },
                { 
                  title: '數量', 
                  dataIndex: 'shares', 
                  key: 'shares', 
                  width: 100,
                  render: (shares) => shares.toLocaleString()
                },
                { 
                  title: '停損價', 
                  dataIndex: 'stopLoss', 
                  key: 'stopLoss', 
                  width: 100,
                  render: (stopLoss) => stopLoss ? `$${stopLoss}` : '-'
                },
                { title: '備註', dataIndex: 'note', key: 'note', width: 200 },
              ]}
              dataSource={record.positionAdjustments || []}
              pagination={false}
              size='small'
            />
          </TabPane>
          
          <TabPane tab="K 線圖" key="kline">
            <KLineChart 
              symbol={record.symbol} 
              positions={record.positionAdjustments || []}
              height={500}
            />
          </TabPane>
          
          <TabPane tab="交易檢討" key="review">
            <div className='relative' style={{ padding: '16px' }}>
              {/* 蓋章樣式的紀律標記 */}
              <div 
                className='stamp-discipline absolute top-0 right-0 shadow-sm'
                style={{
                  background: record.followedDiscipline === 'pass'
                    ? `linear-gradient(135deg, ${CLR_UP}, ${CLR_UP}dd)`
                    : record.followedDiscipline === 'fail'
                    ? `linear-gradient(135deg, ${CLR_DOWN}, ${CLR_DOWN}dd)`
                    : 'linear-gradient(135deg, #faad14, #ffc53d)',
                }}
              >
                <div className='lh-xs' style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {record.followedDiscipline === 'pass' ? '✓' : record.followedDiscipline === 'fail' ? '✗' : '?'}
                </div>
                <div style={{ fontSize: '10px' }}>
                  {record.followedDiscipline === 'pass' ? '紀律' : record.followedDiscipline === 'fail' ? '沒紀律' : '未定'}
                </div>
              </div>
              
              <Row gutter={16}>
                {/* 檢討內容 */}
                <Col span={24} style={{ marginBottom: 16 }}>
                  <div>
                    <strong>檢討內容：</strong>
                    <div style={{ 
                      marginTop: 8, 
                      padding: 8, 
                      background: '#f5f5f5', 
                      borderRadius: 4,
                      minHeight: 60,
                      border: '1px solid #d9d9d9'
                    }}>
                      {record.review?.content || record.reviewNotes || '尚未填寫檢討內容'}
                    </div>
                  </div>
                </Col>

                {/* 錯誤分類和情緒 */}
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <strong>錯誤分類：</strong>
                    <div style={{ marginTop: 4 }}>
                      {record.review?.errorCategory || record.errorCategory ? (
                        <Tag color="red">
                          {errorCategories.find(cat => cat.value === (record.review?.errorCategory || record.errorCategory))?.label || (record.review?.errorCategory || record.errorCategory)}
                        </Tag>
                      ) : (
                        <span style={{ color: '#999' }}>未選擇</span>
                      )}
                    </div>
                  </div>
                </Col>

                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <strong>當時情緒：</strong>
                    <div style={{ marginTop: 4 }}>
                      {record.review?.emotion || record.emotion ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div 
                            style={{ 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              backgroundColor: emotions.find(em => em.value === (record.review?.emotion || record.emotion))?.color || '#666'
                            }} 
                          />
                          <span>
                            {emotions.find(em => em.value === (record.review?.emotion || record.emotion))?.label || (record.review?.emotion || record.emotion)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#999' }}>未選擇</span>
                      )}
                    </div>
                  </div>
                </Col>

                {/* 是否遵守紀律 */}
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <strong>是否遵守紀律：</strong>
                    <div style={{ marginTop: 4 }}>
                      <Switch 
                        checked={record.followedDiscipline === 'pass'}
                        checkedChildren="是" 
                        unCheckedChildren="否"
                        disabled
                      />
                      <span style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
                        {record.followedDiscipline === 'pass' ? '是' : record.followedDiscipline === 'fail' ? '否' : '未處理'}
                      </span>
                    </div>
                  </div>
                </Col>

                {/* 自我評分 */}
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <strong>自我評分：</strong>
                    <div style={{ marginTop: 4 }}>
                      {record.review?.selfRating || record.selfRating ? (
                        <Rate 
                          value={record.review?.selfRating || record.selfRating}
                          disabled
                          allowHalf={false}
                          count={5}
                        />
                      ) : (
                        <span style={{ color: '#999' }}>未評分</span>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </TabPane>
        </Tabs>
      </div>
    )
  }

  // 獲取唯一的股票號碼列表（用於下拉選單選項）
  // 注意：這裡只會取得當前頁面的選項，如需完整選項應從 API 取得
  const getUniqueSymbols = () => {
    if (!displayData.length) return []
    return [...new Set(displayData.map(item => item.symbol))].sort() // 改用後端命名
  }

  // 獲取唯一的策略列表
  // 注意：這裡只會取得當前頁面的選項，如需完整選項應從 API 取得
  const getUniqueStrategies = () => {
    if (!displayData.length) return []
    // 提取策略名稱（處理對象或字符串）
    const strategies = displayData
      .map(item => {
        if (!item.strategy) return null
        if (typeof item.strategy === 'object' && item.strategy !== null) {
          return item.strategy.name
        }
        return item.strategy
      })
      .filter(Boolean)
    return [...new Set(strategies)].sort()
  }
  // 表格欄位定義
  const columns = [
    {
      title: '編號',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, record, index) => {
        // 計算當前頁的起始序號
        const current = pagination?.current || 1
        const pageSize = pagination?.pageSize || 10
        return (current - 1) * pageSize + index + 1
      },
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 70,
      align: 'center',
      render: (direction) => (
        <Tag color={direction === 'long' ? 'green' : 'red'}>
          {direction === 'long' ? '多' : '空'}
        </Tag>
      ),
    },
    {
      title: '股號',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 80,
      align: 'center',
    },
    {
      title: '開倉日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        const dateA = new Date(a.createdAt || 0)
        const dateB = new Date(b.createdAt || 0)
        return dateA - dateB
      },
    },
    {
      title: '清倉日',
      dataIndex: 'closedAt',
      key: 'closedAt',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        const dateA = new Date(a.closedAt || 0)
        const dateB = new Date(b.closedAt || 0)
        return dateA - dateB
      },
      render: (closedAt) => closedAt || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '持倉時間',
      dataIndex: 'holdingDuration',
      key: 'holdingDuration',
      width: 100,
      align: 'center',
      sorter: (a, b) => {
        const durationA = parseFloat(a.holdingDuration) || 0
        const durationB = parseFloat(b.holdingDuration) || 0
        return durationA - durationB
      },
      render: (holdingDuration) => {
        if (!holdingDuration && holdingDuration !== 0) return <span style={{ color: '#999' }}>-</span>
        const days = parseFloat(holdingDuration)
        if (days <= 0) return '當日'
        return `${days.toFixed(1)} 天`
      },
    },
    {
      title: '建倉次數',
      dataIndex: 'entryCount',
      key: 'entryCount',
      width: 90,
      align: 'center',
      // sorter: (a, b) => (a.entryCount || 0) - (b.entryCount || 0),
      render: (entryCount) => entryCount || 0,
    },
    {
      title: '結果',
      dataIndex: 'profitLoss',
      key: 'profitLoss',
      // 不設 width，讓它自動擴展佔用剩餘空間
      align: 'right',
      sorter: (a, b) => (a.profitLoss || 0) - (b.profitLoss || 0),
      render: (profitLoss) => {
        if (profitLoss === null) return <span style={{ color: '#999' }}>-</span>
        const isProfit = profitLoss > 0
        return (
          <span style={{
            color: isProfit ? CLR_UP : CLR_DOWN,
            fontWeight: 'bold'
          }}>
            {profitLoss > 0 ? '+' : ''}{profitLoss.toLocaleString()} 元
          </span>
        )
      },
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 100,
      align: 'center',
      render: (strategy) => {
        // 安全地處理策略欄位：可能是字符串、對象或 null
        if (!strategy) return <span style={{ color: '#999' }}>-</span>
        if (typeof strategy === 'object' && strategy !== null) {
          return strategy.name || <span style={{ color: '#999' }}>-</span>
        }
        return strategy
      },
    },
    {
      title: '紀律',
      dataIndex: 'followedDiscipline',
      key: 'followedDiscipline',
      width: 90,
      align: 'center',
      render: (followedDiscipline) => {
        const disciplineConfig = {
          pass: { icon: <CheckOutlined style={{ color: CLR_UP }} />, text: '通過' },
          fail: { icon: <CloseOutlined style={{ color: CLR_DOWN }} />, text: '失敗' },
          pending: { icon: <MinusOutlined style={{ color: '#faad14' }} />, text: '未處理' },
        }
        const config = disciplineConfig[followedDiscipline] || { icon: null, text: followedDiscipline }
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            {config.icon}
            <span style={{ fontSize: '12px' }}>{config.text}</span>
          </div>
        )
      },
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
      sorter: (a, b) => {
        const order = { 'open': 1, 'completed': 2 }
        return (order[a.status] || 0) - (order[b.status] || 0)
      },
      render: (status) => {
        const statusConfig = {
          open: { color: 'orange', text: '持倉中' },
          completed: { color: 'default', text: '已完成' },
        }
        const config = statusConfig[status] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <div 
          className="Transactions-operation-cell"
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown
            menu={{
              items: [
                {
                  key: 'view',
                  label: '查看詳情',
                  icon: <EyeOutlined />,
                  onClick: () => handleView(record),
                },
                {
                  key: 'edit',
                  label: '編輯交易',
                  icon: <EditOutlined />,
                  onClick: () => handleEditTrade(record),
                },
                {
                  key: 'addPosition',
                  label: '新增倉位',
                  icon: <PlusOutlined />,
                  onClick: () => handleOpenAddPositionModal(record),
                },
              ],
            }}
            trigger={['hover']}
          >
            <Button 
              type="link" 
              size="small" 
              onClick={(e) => e.stopPropagation()}
              className="Transactions-operation-button"
            >
              <ToolOutlined />
            </Button>
          </Dropdown>
        </div>
      ),
    },
  ]

  return (
    <div className='h-full w-full Transactions overflow-hidden'>
      <div className="card h-full px-md overflow-hidden" style={{ position: 'relative', padding: '12px' }}>
        {/* title */}
        <div className="useBetween">
          <div>
            <span className='text-title font-bold font-serif'>交易記錄</span>
            <span className='text-body2 font-bold font-serif ml-base'>本日剩餘紀錄次數 43 / 50</span>
          </div>
          <Button 
            type="primary"
            className='rounded-sm px-lg'
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size="middle"
            >
            開單
          </Button>
        </div>
        {/* filter */}
        <div className='useBetween my-sm py-sm'>
          <div className="useStart gap-sm">
            <RangePicker
              placeholder={['開始時間', '結束時間']}
              className={`rounded-sm ${dateRange ? 'has-value' : ''}`}
              value={dateRange}
              onChange={setDateRange}
              format="YYYY-MM-DD"
              style={{ width: 240 }}
            />
            <Input
              ref={symbolInputRef}
              className={`rounded-sm ${symbolInput ? 'has-value' : ''}`}
              value={symbolInput}
              onChange={(e) => {
                const val = (e.target.value ?? '').replace(/\D/g, '')
                setSymbolInput(val)
                if (!val) {
                  setSymbolFilter(null)
                  setPagination(prev => ({ ...prev, current: 1 }))
                }
              }}
              onPressEnter={(e) => { handleSymbolSearch(); e.target.blur() }}
              placeholder="股票號碼"
              allowClear
              style={{ width: 120 }}
            />
            <Select
              className={`rounded-sm ${strategyFilter ? 'has-value' : ''}`}
              popupClassName="trades-select-dropdown"
              value={strategyFilter}
              onChange={setStrategyFilter}
              placeholder="策略"
              allowClear
              style={{ width: 120 }}
            >
              {getUniqueStrategies().map(strategy => (
                <Option key={strategy} value={strategy}>{strategy}</Option>
              ))}
            </Select>
            <Select
              className={`rounded-sm ${directionFilter ? 'has-value' : ''}`}
              popupClassName="trades-select-dropdown"
              value={directionFilter}
              onChange={setDirectionFilter}
              placeholder="多空"
              allowClear
              style={{ width: 100 }}
            >
              <Option value="long">多</Option>
              <Option value="short">空</Option>
            </Select>
            <Select
              className={`rounded-sm ${statusFilter !== 'all' ? 'has-value' : ''}`}
              popupClassName="trades-select-dropdown"
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="交易狀態"
              style={{ width: 140 }}
            >
              <Option value="all">全部</Option>
              <Option value="open">持倉中</Option>
              <Option value="completed">已清倉</Option>
            </Select>
            {/* 清除按鈕 */}
            {(dateRange || symbolInput || strategyFilter || directionFilter || statusFilter !== 'all') && (
              <Button
                className='reset-filter-btn'
                onClick={handleResetFilters}
              >
                清除
              </Button>
            )}
          </div>
          <div class="useStart gap-sm">
            <Pagination
              size='small'
              className='rounded-xs ml-sm'
              {...pagination}
              onChange={handlePagination}
              onShowSizeChange={handlePagination}
            />
          </div>
        </div>
        {/* table */}
        <PerfectScrollbar className='container bg-white'>
            <Table
            size='small'
            columns={columns}
            dataSource={displayData}
            loading={tradesLoading}
            sticky={true}
            tableLayout='auto'
            scroll={{ x: 'max-content' }}
            expandable={{
              expandedRowRender,
              expandedRowKeys,
              onExpand: handleExpand,
              expandRowByClick: true,
              showExpandColumn: false,
            }}
            onRow={(record) => ({
              onClick: (e) => {
                // 如果按了 Ctrl (Windows/Linux) 或 Cmd (Mac)
                if (e.ctrlKey || e.metaKey) {
                  e.stopPropagation() // 阻止展開 row
                  handleView(record) // 打開 drawer
                }
                // 如果沒有按 Ctrl，保持原本的展開行為（expandRowByClick 會處理）
              },
            })}
            pagination={false}
            />
        </PerfectScrollbar>
        {/* statistic */}
        <div className='Transactions-statistic useStart bg-white px-md'>
          <Statistic 
            title="總交易數" 
            value={pagination.total || 0}
            className="useBaseline gap-sm flex-1"
          />
          <Statistic
            title="本頁持倉中"
            value={displayData.filter(d => d.status === 'open').length}
            valueStyle={{ color: '#faad14' }}
            className="useBaseline gap-sm flex-1"
          />
          <Statistic
            title="本頁盈虧"
            value={displayData.reduce((sum, d) => sum + (d.profitLoss || 0), 0)}
            precision={0}
            valueStyle={{
              color: displayData.reduce((sum, d) => sum + (d.profitLoss || 0), 0) > 0 ? CLR_UP : CLR_DOWN
            }}
            className="useBaseline gap-sm flex-1"
          />
          <Statistic
            title="本頁勝率"
            value={(() => {
              const completed = displayData.filter(d => d.status === 'completed')
              const win = completed.filter(d => (d.profitLoss || 0) > 0).length
              return completed.length > 0 ? ((win / completed.length) * 100).toFixed(1) : 0
            })()}
            suffix="%"
            valueStyle={{ color: '#1890ff' }}
            className="useBaseline gap-sm flex-1"
          />
        </div>

        <TradeDrawer
          visible={drawerVisible}
          onClose={handleCloseDrawer}
          tradeId={tradeId}
          onSaveReview={handleSaveReview}
          onAddPosition={handleOpenAddPositionModal}
          onEditPosition={handleEditPosition}
          onDeletePosition={handleDeletePosition}
          onPositionAddedRef={onPositionAddedRef}
          onDeleteTrade={handleDeleteTrade}
          getContainer={false}
        />

        <AddPositionModal
          visible={addPositionModalVisible}
          onClose={handleCloseAddPositionModal}
          onSave={handleAddPositionToTrade}
          selectedRecord={selectedRecord}
        />

        <AddTradeModal
          visible={addTradeModalVisible}
          onClose={handleCloseAddTradeModal}
          onSave={handleSaveTrade}
          tradeId={editingTrade?.id || null}
          initialData={editingTrade || null}
        />
      </div>
    </div>
  )
}

export default Transactions