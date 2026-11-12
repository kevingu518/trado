import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Empty,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  theme as antdTheme,
  message,
} from 'antd'
import {
  CheckOutlined,
  EditOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useRiskAlerts } from '../contexts/RiskAlertsContext'
import { useRiskExposure } from '../hooks/useRiskExposure'
import ExposureOverview, { ExposureAnalysis } from '../components/ExposureOverview'
import RiskKpi from '../components/RiskKpi'
import '../styles/index.scss'

const ALERT_META = {
  breach:       { label: '跌破停損',   color: 'red'     },
  near:         { label: '接近停損',   color: 'orange'  },
  no_stop:      { label: '未設停損',   color: 'blue'    },
  invalid_stop: { label: '停損設錯邊', color: 'volcano' },
  no_price:     { label: '無收盤價',   color: 'default' },
}

const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString())
const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtDate = (iso) => (iso ? iso.replaceAll('-', '/') : '')

const RiskCenter = () => {
  const navigate = useNavigate()
  const { token } = antdTheme.useToken()
  const {
    asOf,
    alerts,
    summary,
    unackedCount,
    loading,
    acknowledge,
    unacknowledge,
    acknowledgeAll,
    refresh,
  } = useRiskAlerts()

  // 曝險資料拉在頁面層：右欄（KPI＋部位表）與下排（集中度等）共用同一份，只打一次 API
  const exposure = useRiskExposure()

  const [filter, setFilter] = useState('pending')

  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()

  const rows = useMemo(
    () => (filter === 'pending' ? alerts.filter((a) => !a.acknowledged) : alerts),
    [alerts, filter]
  )

  // 停損價要在交易詳情裡調整，所以直接帶 tradeId 過去開 drawer
  const openTrade = (r) => navigate(`/trades?tradeId=${r.tradeId}`)

  const handleAckAll = async () => {
    const ok = await acknowledgeAll()
    if (ok) message.success('已將所有警示標記為已讀')
  }

  // 表格走交易紀錄的密度：每格一行，補充資訊放 tooltip
  const renderDistance = (v, r) => {
    if (v == null) return <span className="text-hint">—</span>
    const color = v <= 0 ? CLR_DOWN : v <= 3 ? token.colorWarning : undefined
    const text = (
      <span className="fw-600" style={{ color }}>
        {v > 0 ? '+' : ''}
        {v.toFixed(2)}%
      </span>
    )
    if (r.remainingR == null) return text
    return (
      <Tooltip title={`以進場均價到停損價為 1R，目前離停損還有 ${r.remainingR.toFixed(2)}R`}>
        {text}
      </Tooltip>
    )
  }

  const columns = [
    {
      title: '標的',
      dataIndex: 'symbol',
      width: 110,
      align: 'center',
      render: (v, r) => (
        <div className="risk-symbol">
          <span className="fw-600">{v}</span>
          <Tag color={r.direction === 'short' ? 'red' : 'green'}>
            {r.direction === 'short' ? '空' : '多'}
          </Tag>
          {r.stale && (
            <Tooltip title={`這檔最新收盤價為 ${fmtDate(r.priceDate)}，比市場最新交易日舊（停牌或抓價失敗）`}>
              <Tag color="default">舊價</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'alertType',
      width: 94,
      render: (t) => {
        const meta = ALERT_META[t] || { label: t, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '股數', dataIndex: 'shares', width: 64, align: 'right', render: fmtInt },
    { title: '均價', dataIndex: 'avgPrice', width: 76, align: 'right', render: fmtPrice },
    {
      title: '停損價',
      dataIndex: 'stopLoss',
      width: 82,
      align: 'right',
      render: (v, r) => {
        if (v == null) return <span className="text-hint">未設定</span>
        // 停損設錯邊時狀態欄已經標了，這裡不再重複掛 Tag，省一格寬度
        if (r.stopRiskAmount == null) {
          return (
            <Tooltip title="停損在成本的另一側，最大虧損沒有上限">
              <span className="fw-600">{fmtPrice(v)}</span>
            </Tooltip>
          )
        }
        return (
          <Tooltip title={`若跌到停損價出場，預估虧損 −${Number(r.stopRiskAmount).toLocaleString()}`}>
            <span className="fw-600">{fmtPrice(v)}</span>
          </Tooltip>
        )
      },
    },
    {
      title: '最新收盤',
      dataIndex: 'currentPrice',
      width: 76,
      align: 'right',
      render: (v, r) =>
        v == null ? (
          <span className="text-hint">—</span>
        ) : (
          <Tooltip title={`收盤日 ${fmtDate(r.priceDate)}`}>
            <span className="fw-600">{fmtPrice(v)}</span>
          </Tooltip>
        ),
    },
    {
      title: (
        <Tooltip title="以停損價為基準。負數＝已跌破；+3% 內視為接近">
          <span className="risk-th-help">距停損</span>
        </Tooltip>
      ),
      dataIndex: 'distancePct',
      width: 74,
      align: 'right',
      render: renderDistance,
    },
    {
      title: '未實現損益',
      dataIndex: 'unrealizedPnL',
      width: 88,
      align: 'right',
      render: (v) =>
        v == null ? (
          <span className="text-hint">—</span>
        ) : (
          <span className="fw-600" style={{ color: v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : undefined }}>
            {v > 0 ? '+' : ''}
            {Number(v).toLocaleString()}
          </span>
        ),
    },
    {
      // 固定在右邊：表格比面板寬時，操作欄不會被推到看不見的地方
      title: '',
      key: 'actions',
      width: 72,
      align: 'right',
      fixed: 'right',
      render: (_, r) => (
        // 每列都一樣的操作按鈕，預設隱藏、hover 才淡入，避免干擾閱讀
        <div
          className="risk-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="到交易詳情調整停損價">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openTrade(r)}
            />
          </Tooltip>
          <Tooltip title={r.acknowledged ? '取消已讀' : '今天不用再提醒'}>
            <Button
              size="small"
              type="text"
              icon={r.acknowledged ? <UndoOutlined /> : <CheckOutlined />}
              onClick={() => (r.acknowledged ? unacknowledge(r) : acknowledge(r))}
            />
          </Tooltip>
        </div>
      ),
    },
  ]

  // 左右兩張表用同一個表身高度，面板才會一樣高；資料少時跟著縮，內容多再自己捲
  // （39px 是 small 表的列高）
  const exposureRowCount = exposure.data?.positions?.length ?? 0
  const tableHeight = Math.max(
    160,
    Math.min(320, Math.max(rows.length, exposureRowCount) * 39 + 4)
  )

  const emptyText = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        alerts.length === 0
          ? '目前持倉沒有觸發任何停損警示'
          : filter === 'pending'
            ? '今天的警示都處理完了'
            : '沒有警示'
      }
    />
  )

  return (
    <div className="RiskCenter">
      {/* 標題列：版面比照交易紀錄，左標題＋切換、右操作 */}
      <div className="RiskCenter-header">
        <div className="RiskCenter-header-title">
          <span className="text-title font-serif">風險中心</span>
          <Segmented
            className="risk-segmented font-serif"
            value={filter}
            onChange={setFilter}
            options={[
              { label: `未處理 ${unackedCount}`, value: 'pending' },
              { label: `全部 ${alerts.length}`, value: 'all' },
            ]}
          />
        </div>
        <Space size={8} wrap>
          <Button className="rounded-sm" icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            重新整理
          </Button>
          <Popconfirm
            title="把目前所有警示標記為已讀？"
            description="下一個交易日收盤後會重新計算。"
            onConfirm={handleAckAll}
            disabled={unackedCount === 0}
          >
            <Button type="primary" className="rounded-sm" disabled={unackedCount === 0}>
              全部已讀
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 左右分工：左＝今天要處理的事，右＝曝險；分析放最下面一整排 */}
      <div className="risk-dashboard">
        {/* 今日概況：一行一項，左標籤＋說明、右數字，跟下方表格同一種節奏 */}
        <div className="risk-summary risk-area-summary-l">
          <div className="risk-summary-head">
            <span className="text-subtitle font-serif">今日概況</span>
            <span className="text-hint">
              {asOf ? `${fmtDate(asOf)} 收盤價 · 非即時報價` : ''}
            </span>
          </div>
          <div className="risk-summary-list">
            <RiskKpi
              label="跌破停損"
              value={summary.breach}
              status={summary.breach > 0 ? 'danger' : 'neutral'}
              hint="收盤價已跌破停損價，需要今天處理"
              sub="需今天處理"
            />
            <RiskKpi
              label="接近停損"
              value={summary.near}
              status={summary.near > 0 ? 'warning' : 'neutral'}
              hint="距停損 3% 內，先想好怎麼做"
              sub="距停損 3% 內"
            />
            <RiskKpi
              label="未設停損"
              value={summary.noStop}
              status={summary.noStop > 0 ? 'warning' : 'neutral'}
              hint="有持倉但沒有停損價，等於沒有風控"
              sub="沒有停損價"
            />
            <RiskKpi
              label="停損設錯邊"
              value={summary.invalidStop}
              status={summary.invalidStop > 0 ? 'danger' : 'neutral'}
              hint="多單停損高於成本、空單停損低於成本，風險不是正數"
              sub="風險不是正數"
            />
            {/* 一律顯示：右邊曝險總覽也是六列，兩塊高度才會一致 */}
            <RiskKpi
              label="無收盤價"
              value={summary.noPrice}
              status={summary.noPrice > 0 ? 'warning' : 'neutral'}
              hint="停牌或抓價失敗，這檔沒有可用的收盤價"
              sub="停牌或抓價失敗"
            />
            <RiskKpi
              label="持倉檔數"
              value={summary.openPositions}
              hint="目前未平倉的部位數"
              sub="未平倉部位"
            />
          </div>
        </div>

        {/* 今日警示 */}
        <div className="risk-panel risk-area-panel-l">
          <div className="risk-panel-head">
            <span className="text-subtitle font-serif">今日警示</span>
            <span className="text-hint">點列開啟交易詳情調整停損</span>
          </div>
          <Table
            rowKey={(r) => `${r.tradeId}-${r.alertType}`}
            size="small"
            columns={columns}
            dataSource={rows}
            loading={loading && alerts.length === 0}
            pagination={false}
            locale={{ emptyText }}
            rowClassName={(r) => (r.acknowledged ? 'risk-row-acked' : '')}
            onRow={(r) => ({
              className: 'risk-row-clickable',
              onClick: () => openTrade(r),
            })}
            scroll={{ x: 736, y: tableHeight }}
          />
        </div>
        <ExposureOverview exposure={exposure} tableHeight={tableHeight} />
      </div>

      {/* 集中度、族群偏離、建議：三欄並排，橫跨整個頁寬 */}
      <ExposureAnalysis exposure={exposure} />
    </div>
  )
}

export default RiskCenter
