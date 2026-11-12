import React from 'react'
import { Skeleton } from 'antd'

const fmtNumber = (v, digits = 2) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('zh-TW', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })

const fmtChange = (change, pct) => {
  if (change == null) return '—'
  const sign = change > 0 ? '+' : ''
  const pctText = pct == null ? '' : `（${sign}${(pct * 100).toFixed(2)}%）`
  return `${sign}${fmtNumber(change)}${pctText}`
}

const fmtTurnover = (v) => (v == null || v === 0 ? '—' : `${fmtNumber(v / 1e8, 0)} 億`)

/** 盤面摘要：表單與 K 線上方那排數字，全部由後端算好帶進來 */
const MarketStrip = ({ date, isToday, context, loading }) => {
  if (loading && !context) {
    return <Skeleton active paragraph={{ rows: 1 }} title={false} />
  }

  if (!context) {
    return <div className="journal-strip journal-strip-muted">盤面資料暫時取得不到</div>
  }

  if (!context.isTradingDay) {
    return (
      <div className="journal-strip journal-strip-muted">
        {isToday ? '今天休市' : '這天休市'}，沒有盤面資料
      </div>
    )
  }

  const m = context.market || {}
  const tone = m.change > 0 ? 'up' : m.change < 0 ? 'down' : null
  const cells = [
    { label: '加權收盤', value: fmtNumber(m.close) },
    { label: '漲跌點（%）', value: fmtChange(m.change, m.changePct), tone },
    { label: '成交金額', value: fmtTurnover(m.turnover) },
    {
      label: '20 日年化波動',
      value: m.volatility20 == null ? '—' : `${(m.volatility20 * 100).toFixed(1)}%`,
    },
  ]

  return (
    <div className="journal-strip">
      <span className="journal-strip-date">{date}</span>
      {cells.map((c) => (
        <div className="journal-strip-cell" key={c.label}>
          <span className="journal-strip-label">{c.label}</span>
          <span className={`journal-strip-value ${c.tone ? `is-${c.tone}` : ''}`}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default MarketStrip
