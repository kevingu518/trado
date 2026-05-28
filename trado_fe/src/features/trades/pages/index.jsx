// src/pages/Transactions/index.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react'
import dayjs from 'dayjs'

import { Table, Tag, Button, Space, message, Card, Row, Col, Tooltip, DatePicker, Select, Input, Pagination, Statistic, Dropdown, Segmented } from 'antd'

const { Option } = Select;
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
import DailyPositionsView from '../components/DailyPositionsView'

const { RangePicker } = DatePicker;

const Transactions = () => {
  // -------------------------   variables   ----------------------------
  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()
  const CLR_NONE = '#666'
  const pnlColor = (v) => v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE

  // 視圖模式：'trades' = 交易記錄；'daily' = 每日進出
  const [viewMode, setViewMode] = useState('trades')

  // 新增過濾器狀態（使用後端命名）
  // Filter states
  const [dateRange, setDateRange] = useState(null) // 時間範圍
  const [symbolInput, setSymbolInput] = useState('') // 股票輸入值
  const [symbolFilter, setSymbolFilter] = useState(null) // 股票號碼（debounced，送 API）
  const [directionFilter, setDirectionFilter] = useState(null) // 多空方向
  const [statusFilter, setStatusFilter] = useState('all') // 交易狀態
  const [strategyFilter, setStrategyFilter] = useState(null) // 策略
  const [actionFilter, setActionFilter] = useState('all') // 每日進出視圖：買進/賣出

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [addPositionModalVisible, setAddPositionModalVisible] = useState(false)
  const [addTradeModalVisible, setAddTradeModalVisible] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null) // 正在編輯的交易資料
  const [selectedRecord, setSelectedRecord] = useState(null)
  // 鍵盤導覽：被「框選」的列 key（null 表示尚未選中任何列）
  const [focusedRowKey, setFocusedRowKey] = useState(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (total, range) =>
      `第 ${range[0]}-${range[1]} 項，共 ${total} 項`,
  })
  // 每日進出視圖獨立的 pagination（單位是「天」，非「筆」）
  const [dailyPagination, setDailyPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 30, 60, 90],
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 天，共 ${total} 天`,
  })

  // filter 變動時，daily pagination 回到第 1 頁
  useEffect(() => {
    setDailyPagination(prev => ({ ...prev, current: 1 }))
  }, [dateRange, symbolFilter, directionFilter, actionFilter])

  const handleDailyPagination = (current, pageSize) =>
    setDailyPagination(prev => ({ ...prev, current, pageSize }))

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
    setActionFilter('all')
  }

  // 快捷鍵：n 開單 / / focus 股號搜尋 / r 清除過濾 / s 切換狀態 / a 切換動作 / v 切換視圖
  useShortcut('trades-new', () => handleAdd())
  useShortcut('trades-search', () => symbolInputRef.current?.focus())
  useShortcut('trades-reset', () => handleResetFilters())
  useShortcut('trades-view-toggle', () => {
    setViewMode((prev) => (prev === 'trades' ? 'daily' : 'trades'))
  })
  useShortcut('trades-status-cycle', () => {
    // 用 functional setState 讀最新值，避免閉包過期
    setStatusFilter((prev) => {
      const order = ['all', 'open', 'completed']
      const idx = order.indexOf(prev)
      return order[(idx + 1) % order.length]
    })
  }, { enabled: viewMode === 'trades', deps: [viewMode] })
  useShortcut('trades-action-cycle', () => {
    setActionFilter((prev) => {
      const order = ['all', 'buy', 'sell']
      const idx = order.indexOf(prev)
      return order[(idx + 1) % order.length]
    })
  }, { enabled: viewMode === 'daily', deps: [viewMode] })

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

  // 換頁/換 filter 後，如果焦點 key 已不在當前資料中就清掉
  useEffect(() => {
    if (focusedRowKey != null && !displayData.some((r) => r.key === focusedRowKey)) {
      setFocusedRowKey(null)
    }
  }, [displayData, focusedRowKey])

  // 焦點變動時把該列捲到可視範圍
  useEffect(() => {
    if (focusedRowKey == null) return
    const el = document.querySelector(
      `.Transactions .ant-table-row[data-row-key="${focusedRowKey}"]`
    )
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [focusedRowKey])

  // 鍵盤導覽（↑/↓ 移動框選、Enter 開啟詳情）：
  // 放在 displayData 計算之後，避免 deps 在 TDZ 中讀到 displayData
  // 有 drawer / modal 開啟時禁用，避免和裡面的鍵盤行為打架
  const overlayOpen = drawerVisible || addPositionModalVisible || addTradeModalVisible
  const tradesNavEnabled = !overlayOpen && viewMode === 'trades'
  useShortcut('trades-row-up', () => {
    setFocusedRowKey((prev) => {
      if (!displayData.length) return prev
      if (prev == null) return displayData[0].key
      const idx = displayData.findIndex((r) => r.key === prev)
      if (idx <= 0) return displayData[0].key
      return displayData[idx - 1].key
    })
  }, { enabled: tradesNavEnabled, deps: [displayData, tradesNavEnabled] })
  useShortcut('trades-row-down', () => {
    setFocusedRowKey((prev) => {
      if (!displayData.length) return prev
      if (prev == null) return displayData[0].key
      const idx = displayData.findIndex((r) => r.key === prev)
      if (idx < 0 || idx >= displayData.length - 1) return displayData[displayData.length - 1].key
      return displayData[idx + 1].key
    })
  }, { enabled: tradesNavEnabled, deps: [displayData, tradesNavEnabled] })
  useShortcut('trades-row-first', () => {
    if (!displayData.length) return
    setFocusedRowKey(displayData[0].key)
    // 同時模擬 Home 的捲動行為：把表格容器歸零，讓 sticky thead 回到自然位置，不會壓到第一列
    const container = document.querySelector('.Transactions .container')
    if (container) container.scrollTop = 0
  }, { enabled: tradesNavEnabled, deps: [displayData, tradesNavEnabled] })
  useShortcut('trades-row-last', () => {
    if (!displayData.length) return
    setFocusedRowKey(displayData[displayData.length - 1].key)
    const container = document.querySelector('.Transactions .container')
    if (container) container.scrollTop = container.scrollHeight
  }, { enabled: tradesNavEnabled, deps: [displayData, tradesNavEnabled] })
  useShortcut('trades-row-open', () => {
    if (focusedRowKey == null) return
    const record = displayData.find((r) => r.key === focusedRowKey)
    if (record) handleView(record)
  }, { enabled: tradesNavEnabled, deps: [displayData, focusedRowKey, tradesNavEnabled] })

  // -------------------------   functions   ----------------------------
  // 處理新增交易 - 彈出新增 trade modal
  const handleAdd = () => {
    setAddTradeModalVisible(true)
  }

  // 處理新增 trade（可選同時建立倉位、可選同步補入金）
  const handleAddTrade = async (tradeData, positionData = null, depositData = null) => {
    try {
      // 準備 API payload（使用前端格式，DTO 會自動轉換）
      // firstPosition / deposit 會由後端 createTrade 在同一個 transaction 內寫入
      const payload = {
        symbol: tradeData.symbol,
        direction: tradeData.direction, // "long" 或 "short"
        status: 'open', // 新增時預設為 open
        followedDiscipline: 'pending', // 新增時預設為 pending
        strategyId: tradeData.strategyId || null,
        createdAt: tradeData.createdAt, // 已經是 YYYY-MM-DD 格式
        closedAt: tradeData.closedAt || null,
        note: tradeData.note || null,
        ...(positionData && { firstPosition: positionData }),
        ...(depositData && { deposit: depositData }),
      }

      // 使用 hook 的 createTrade 方法（atomic：trade + firstPosition + deposit）
      const { err: error } = await createTrade(payload)

      if (error) {
        message.error(error.msg || error.message || '新增交易記錄失敗')
        return
      }

      const successMsg = depositData
        ? '交易、倉位與入金已同步新增'
        : positionData
          ? '交易記錄與倉位已新增'
          : '交易記錄已新增'
      message.success(successMsg)
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
  const handleSaveTrade = async (tradeIdOrData, tradeDataOrPosition, depositData = null) => {
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
        // 新增模式：第一個是 tradeData，第二個是 positionData（可選），第三個是 depositData（可選）
        await handleAddTrade(tradeIdOrData, tradeDataOrPosition, depositData)
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
      title: '最新收盤',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 90,
      align: 'right',
      render: (currentPrice, record) => {
        if (record.status !== 'open') return <span style={{ color: '#999' }}>-</span>
        if (currentPrice == null) return <span style={{ color: '#999' }}>-</span>
        return <span>${currentPrice.toFixed(2)}</span>
      },
    },
    {
      title: '盈虧',
      key: 'pnl',
      // 不設 width，讓它自動擴展佔用剩餘空間
      align: 'right',
      sorter: (a, b) => {
        const av = a.status === 'open' ? (a.unrealizedPnL ?? -Infinity) : (a.profitLoss ?? -Infinity)
        const bv = b.status === 'open' ? (b.unrealizedPnL ?? -Infinity) : (b.profitLoss ?? -Infinity)
        return av - bv
      },
      // 浮 / 實用視覺差異區分（持倉中=淡色 + 中等粗細；已平倉=飽和色 + bold），
      // 因為「狀態」欄已有持倉中 / 已完成 tag，盈虧欄不再重複加「浮」標籤
      render: (_, record) => {
        const isOpen = record.status === 'open'
        const value = isOpen ? record.unrealizedPnL : record.profitLoss
        if (value == null) return <span style={{ color: '#999' }}>-</span>
        const isProfit = value > 0
        return (
          <span style={{
            color: isProfit ? CLR_UP : CLR_DOWN,
            fontWeight: isOpen ? 500 : 700,
            opacity: isOpen ? 0.7 : 1,
          }}>
            {value > 0 ? '+' : ''}{value.toLocaleString()} 元
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
          <div className='useStart gap-base'>
            <Segmented
              className='trades-view-segmented font-serif'
              value={viewMode}
              onChange={setViewMode}
              options={[
                { label: '交易記錄', value: 'trades' },
                { label: '每日進出', value: 'daily' },
              ]}
            />
            {/* {viewMode === 'trades' && (
              <span className='text-body2 font-bold font-serif ml-base'>本日剩餘紀錄次數 43 / 50</span>
            )} */}
          </div>
          {viewMode === 'trades' && (
            <Button
              type="primary"
              className='rounded-sm px-lg'
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size="middle"
            >
              開單
            </Button>
          )}
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
            {viewMode === 'trades' && (
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
            )}
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
            {viewMode === 'trades' && (
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
            )}
            {viewMode === 'daily' && (
              <Select
                className={`rounded-sm ${actionFilter !== 'all' ? 'has-value' : ''}`}
                popupClassName="trades-select-dropdown"
                value={actionFilter}
                onChange={setActionFilter}
                placeholder="動作"
                style={{ width: 120 }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '買進', value: 'buy' },
                  { label: '賣出', value: 'sell' },
                ]}
              />
            )}
            {/* 清除按鈕 */}
            {(dateRange || symbolInput || directionFilter
              || (viewMode === 'trades' && (strategyFilter || statusFilter !== 'all'))
              || (viewMode === 'daily' && actionFilter !== 'all')) && (
              <Button
                className='reset-filter-btn'
                onClick={handleResetFilters}
              >
                清除
              </Button>
            )}
          </div>
          {viewMode === 'trades' && (
            <div class="useStart gap-sm">
              <Pagination
                size='small'
                className='rounded-xs ml-sm'
                {...pagination}
                onChange={handlePagination}
                onShowSizeChange={handlePagination}
              />
            </div>
          )}
          {viewMode === 'daily' && (
            <div class="useStart gap-sm">
              <Pagination
                size='small'
                className='rounded-xs ml-sm'
                {...dailyPagination}
                onChange={handleDailyPagination}
                onShowSizeChange={handleDailyPagination}
              />
            </div>
          )}
        </div>
        {viewMode === 'trades' ? (
          <>
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
                rowClassName={(record) => record.key === focusedRowKey ? 'Transactions-row-focused' : ''}
                onRow={(record) => ({
                  onClick: () => handleView(record),
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
                title="本頁已實現"
                value={displayData.reduce((sum, d) => sum + (d.profitLoss || 0), 0)}
                precision={0}
                valueStyle={{
                  color: displayData.reduce((sum, d) => sum + (d.profitLoss || 0), 0) > 0 ? CLR_UP : CLR_DOWN
                }}
                className="useBaseline gap-sm flex-1"
              />
              <Statistic
                title="本頁未實現"
                value={displayData.reduce((sum, d) => sum + (d.status === 'open' ? (d.unrealizedPnL || 0) : 0), 0)}
                precision={0}
                valueStyle={{
                  color: displayData.reduce((sum, d) => sum + (d.status === 'open' ? (d.unrealizedPnL || 0) : 0), 0) > 0 ? CLR_UP : CLR_DOWN
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
          </>
        ) : (
          <DailyPositionsView
            dateRange={dateRange}
            symbolFilter={symbolFilter}
            directionFilter={directionFilter}
            actionFilter={actionFilter}
            pagination={dailyPagination}
            onPaginationChange={setDailyPagination}
            keyboardEnabled={!overlayOpen}
            onViewTrade={(tradeId) => {
              setSelectedRecord({ id: tradeId })
              setDrawerVisible(true)
            }}
          />
        )}

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