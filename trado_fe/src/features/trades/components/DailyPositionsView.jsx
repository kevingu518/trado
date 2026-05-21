import React, { useState, useEffect, useMemo } from 'react'
import { Table, Tag, Tooltip, Statistic, Empty, message } from 'antd'
import PerfectScrollbar from 'react-perfect-scrollbar'

import { useDailyPositions } from '../hooks/useDailyPositions'
import { useShortcut } from '@/shortcuts'

const root = getComputedStyle(document.documentElement)
const CLR_UP = root.getPropertyValue('--color-up').trim()
const CLR_DOWN = root.getPropertyValue('--color-down').trim()
const CLR_NONE = '#666'
const pnlColor = (v) => (v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE)
const fmtAmount = (v) => Math.round(v).toLocaleString()
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const dayOfWeekNum = (yyyyMmDd) => {
  if (!yyyyMmDd) return -1
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number)
  if (!y || !m || !d) return -1
  return new Date(y, m - 1, d).getDay()
}
const weekdayOf = (yyyyMmDd) => {
  const d = dayOfWeekNum(yyyyMmDd)
  return d >= 0 ? WEEKDAY_LABELS[d] : ''
}

const DailyPositionsView = ({
  dateRange,
  symbolFilter,
  directionFilter,
  actionFilter,
  pagination,
  onPaginationChange,
  onViewTrade,
  keyboardEnabled = true,
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const [focusedRowKey, setFocusedRowKey] = useState(null)

  const { data, loading, error } = useDailyPositions({
    page: pagination.current,
    pageSize: pagination.pageSize,
    startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
    symbol: symbolFilter,
    direction: directionFilter,
    action: actionFilter === 'all' ? undefined : actionFilter,
  })

  useEffect(() => {
    if (error) {
      console.error('取得每日進出資料失敗:', error)
      message.error(error.msg || '取得每日進出資料失敗')
    }
  }, [error])

  useEffect(() => {
    if (!onPaginationChange) return
    if (data) {
      onPaginationChange(prev => ({
        ...prev,
        total: data.total || 0,
        current: data.page || prev.current,
        pageSize: data.pageSize || prev.pageSize,
      }))
    } else {
      onPaginationChange(prev => ({ ...prev, total: 0 }))
    }
  }, [data, onPaginationChange])

  const days = useMemo(() => data?.list || [], [data])

  // 換頁/換 filter 後，如果焦點 key 已不在當前資料中就清掉
  useEffect(() => {
    if (focusedRowKey != null && !days.some(d => d.key === focusedRowKey)) {
      setFocusedRowKey(null)
    }
  }, [days, focusedRowKey])



  // 焦點變動時把該列捲到可視範圍
  useEffect(() => {
    if (focusedRowKey == null) return
    const el = document.querySelector(
      `.Transactions .ant-table-row[data-row-key="${focusedRowKey}"]`
    )
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [focusedRowKey])

  // 鍵盤導覽：沿用 trades 頁面的同一組快捷鍵（Enter 改為展開/收合該日）
  useShortcut('trades-row-up', () => {
    setFocusedRowKey((prev) => {
      if (!days.length) return prev
      if (prev == null) return days[0].key
      const idx = days.findIndex((d) => d.key === prev)
      if (idx <= 0) return days[0].key
      return days[idx - 1].key
    })
  }, { enabled: keyboardEnabled, deps: [days, keyboardEnabled] })
  useShortcut('trades-row-down', () => {
    setFocusedRowKey((prev) => {
      if (!days.length) return prev
      if (prev == null) return days[0].key
      const idx = days.findIndex((d) => d.key === prev)
      if (idx < 0 || idx >= days.length - 1) return days[days.length - 1].key
      return days[idx + 1].key
    })
  }, { enabled: keyboardEnabled, deps: [days, keyboardEnabled] })
  useShortcut('trades-row-first', () => {
    if (!days.length) return
    setFocusedRowKey(days[0].key)
  }, { enabled: keyboardEnabled, deps: [days, keyboardEnabled] })
  useShortcut('trades-row-last', () => {
    if (!days.length) return
    setFocusedRowKey(days[days.length - 1].key)
  }, { enabled: keyboardEnabled, deps: [days, keyboardEnabled] })
  useShortcut('trades-row-open', () => {
    if (focusedRowKey == null) return
    setExpandedRowKeys((prev) =>
      prev.includes(focusedRowKey)
        ? prev.filter((k) => k !== focusedRowKey)
        : [...prev, focusedRowKey]
    )
  }, { enabled: keyboardEnabled, deps: [focusedRowKey, keyboardEnabled] })

  const handleExpand = (expanded, record) => {
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, record.key])
    } else {
      setExpandedRowKeys(expandedRowKeys.filter(k => k !== record.key))
    }
  }

  const adjustmentsColumns = [
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 60,
      render: (dir) => (
        <Tag color={dir === 'long' ? CLR_UP : CLR_DOWN} style={{ color: '#fff', border: 0 }}>
          {dir === 'long' ? '多' : '空'}
        </Tag>
      ),
    },
    {
      title: '標的',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 90,
      render: (sym, adj) => (
        <a
          onClick={(e) => {
            e.stopPropagation()
            onViewTrade?.(adj.tradeId)
          }}
        >
          {sym}
        </a>
      ),
    },
    {
      title: '動作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action, adj) => (
        <span>
          <Tag color={action === 'buy' ? CLR_UP : CLR_DOWN} style={{ color: '#fff', border: 0 }}>
            {action === 'buy' ? '買入' : '賣出'}
          </Tag>
          {adj.isDayTrade && <Tag color="gold">當沖</Tag>}
        </span>
      ),
    },
    {
      title: '股數',
      dataIndex: 'shares',
      key: 'shares',
      width: 90,
      align: 'right',
      render: (v) => v.toLocaleString(),
    },
    {
      title: '價格',
      dataIndex: 'price',
      key: 'price',
      width: 90,
      align: 'right',
      render: (v) => `$${v}`,
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right',
      render: (v) => `$${fmtAmount(v)}`,
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategy',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '備註',
      dataIndex: 'note',
      key: 'note',
      render: (v) =>
        v ? (
          <Tooltip title={v}>
            <span
              style={{
                display: 'inline-block',
                maxWidth: 240,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                verticalAlign: 'bottom',
              }}
            >
              {v}
            </span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ]

  const expandedRowRender = (record) => (
    <div className='expandedRow' style={{ padding: '12px 16px' }}>
      <Table
        size='small'
        rowKey='id'
        columns={adjustmentsColumns}
        dataSource={record.adjustments}
        pagination={false}
      />
    </div>
  )

  const renderSymbols = (symbols) => {
    if (!symbols?.length) return '-'
    const head = symbols.slice(0, 5)
    const rest = symbols.slice(5)
    return (
      <span>
        {head.map(s => (
          <Tag key={s} style={{ marginRight: 4 }}>{s}</Tag>
        ))}
        {rest.length > 0 && (
          <Tooltip title={rest.join('、')}>
            <Tag>+{rest.length}</Tag>
          </Tooltip>
        )}
      </span>
    )
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (v) => (
        <span>
          <span className='font-medium'>{v}</span>
          <span style={{ color: '#999', marginLeft: 4 }}>({weekdayOf(v)})</span>
        </span>
      ),
    },
    {
      title: '進場',
      dataIndex: 'buyCount',
      key: 'buyCount',
      width: 80,
      align: 'center',
      render: (v) => (v > 0 ? <Tag color='green'>{v}</Tag> : <span style={{ color: '#bbb' }}>0</span>),
    },
    {
      title: '出場',
      dataIndex: 'sellCount',
      key: 'sellCount',
      width: 80,
      align: 'center',
      render: (v) => (v > 0 ? <Tag color='red'>{v}</Tag> : <span style={{ color: '#bbb' }}>0</span>),
    },
    {
      title: '標的',
      dataIndex: 'symbols',
      key: 'symbols',
      render: renderSymbols,
    },
    {
      title: '買進金額',
      dataIndex: 'buyAmount',
      key: 'buyAmount',
      width: 130,
      align: 'right',
      render: (v) => (v > 0 ? `$${fmtAmount(v)}` : '-'),
    },
    {
      title: '賣出金額',
      dataIndex: 'sellAmount',
      key: 'sellAmount',
      width: 130,
      align: 'right',
      render: (v) => (v > 0 ? `$${fmtAmount(v)}` : '-'),
    },
    {
      title: '淨現金流',
      dataIndex: 'netCashFlow',
      key: 'netCashFlow',
      width: 130,
      align: 'right',
      render: (v) => (
        <span style={{ color: pnlColor(v), fontWeight: 500 }}>
          {v > 0 ? '+' : ''}${fmtAmount(v)}
        </span>
      ),
    },
    {
      title: '手續費+稅',
      dataIndex: 'totalFee',
      key: 'feeTax',
      width: 110,
      align: 'right',
      render: (_, r) => {
        const total = (r.totalFee || 0) + (r.totalTax || 0)
        return total > 0 ? <span style={{ color: '#999' }}>${fmtAmount(total)}</span> : '-'
      },
    },
  ]

  const pageBuyTotal = days.reduce((s, d) => s + (d.buyAmount || 0), 0)
  const pageSellTotal = days.reduce((s, d) => s + (d.sellAmount || 0), 0)
  const pageNetTotal = days.reduce((s, d) => s + (d.netCashFlow || 0), 0)

  return (
    <>
      {/* table */}
      <PerfectScrollbar className='container bg-white'>
        <Table
          size='small'
          rowKey='key'
          columns={columns}
          dataSource={days}
          loading={loading}
          sticky={true}
          tableLayout='auto'
          scroll={{ x: 'max-content' }}
          rowClassName={(record) => {
            const classes = []
            if (record.key === focusedRowKey) classes.push('Transactions-row-focused')
            if (dayOfWeekNum(record.date) === 1) classes.push('DailyPositions-row-week-start')
            return classes.join(' ')
          }}
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpand: handleExpand,
            expandRowByClick: true,
            showExpandColumn: false,
            rowExpandable: (record) => (record.adjustments?.length || 0) > 0,
          }}
          pagination={false}
          locale={{ emptyText: <Empty description='此區間無交易活動' /> }}
        />
      </PerfectScrollbar>

      {/* statistic */}
      <div className='Transactions-statistic useStart bg-white px-md'>
        <Statistic
          title='本頁交易天數'
          value={days.length}
          className='useBaseline gap-sm flex-1'
        />
        <Statistic
          title='本頁總買進'
          value={pageBuyTotal}
          precision={0}
          valueStyle={{ color: CLR_DOWN }}
          className='useBaseline gap-sm flex-1'
        />
        <Statistic
          title='本頁總賣出'
          value={pageSellTotal}
          precision={0}
          valueStyle={{ color: CLR_UP }}
          className='useBaseline gap-sm flex-1'
        />
        <Statistic
          title='本頁淨現金流'
          value={pageNetTotal}
          precision={0}
          valueStyle={{ color: pnlColor(pageNetTotal) }}
          className='useBaseline gap-sm flex-1'
        />
      </div>
    </>
  )
}

export default DailyPositionsView
