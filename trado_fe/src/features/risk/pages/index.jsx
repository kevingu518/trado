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
  AlertOutlined,
  CheckOutlined,
  EditOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useRiskAlerts } from '../contexts/RiskAlertsContext'
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
const shortDate = (iso) => (iso ? iso.slice(5).replace('-', '/') : '')
const fmtDate = (iso) => (iso ? iso.replaceAll('-', '/') : '')

const Kpi = ({ label, value, color, hint }) => (
  <Tooltip title={hint || null}>
    <div className="risk-kpi">
      <span className="risk-kpi-label text-hint">{label}</span>
      <span className="risk-kpi-value fw-600" style={{ color }}>
        {value}
      </span>
    </div>
  </Tooltip>
)

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

  const renderDistance = (v, r) => {
    if (v == null) return <span className="text-hint">—</span>
    const color = v <= 0 ? CLR_DOWN : v <= 3 ? token.colorWarning : undefined
    return (
      <div className="risk-price">
        <span className="fw-600" style={{ color }}>
          {v > 0 ? '+' : ''}
          {v.toFixed(2)}%
        </span>
        {r.remainingR != null && (
          <Tooltip title="以進場均價到停損價為 1R，目前離停損還有幾個 R">
            <span className="text-hint" style={{ cursor: 'help' }}>
              {r.remainingR.toFixed(2)}R
            </span>
          </Tooltip>
        )}
      </div>
    )
  }

  const columns = [
    {
      title: '標的',
      dataIndex: 'symbol',
      width: 120,
      render: (v, r) => (
        <div className="risk-symbol">
          <span className="fw-600">{v}</span>
          <Tag color={r.direction === 'short' ? 'purple' : 'blue'}>
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
      width: 108,
      render: (t) => {
        const meta = ALERT_META[t] || { label: t, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '股數', dataIndex: 'shares', width: 76, align: 'right', render: fmtInt },
    { title: '均價', dataIndex: 'avgPrice', width: 92, align: 'right', render: fmtPrice },
    {
      title: '停損價',
      dataIndex: 'stopLoss',
      width: 112,
      align: 'right',
      render: (v, r) => {
        if (v == null) return <span className="text-hint">未設定</span>
        return (
          <div className="risk-price">
            <span className="fw-600">{fmtPrice(v)}</span>
            {r.stopRiskAmount != null && (
              <Tooltip title="若跌到停損價出場的預估虧損">
                <span className="text-hint">
                  −{Number(r.stopRiskAmount).toLocaleString()}
                </span>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: '最新收盤',
      dataIndex: 'currentPrice',
      width: 110,
      align: 'right',
      render: (v, r) =>
        v == null ? (
          <span className="text-hint">—</span>
        ) : (
          <div className="risk-price">
            <span className="fw-600">{fmtPrice(v)}</span>
            <span className="text-hint">{shortDate(r.priceDate)}</span>
          </div>
        ),
    },
    {
      title: (
        <Tooltip title="以停損價為基準。負數＝已跌破；+3% 內視為接近">
          <span className="risk-th-help">距停損</span>
        </Tooltip>
      ),
      dataIndex: 'distancePct',
      width: 96,
      align: 'right',
      render: renderDistance,
    },
    {
      title: '未實現損益',
      dataIndex: 'unrealizedPnL',
      width: 116,
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
      title: '',
      key: 'actions',
      width: 72,
      align: 'right',
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
          <span className="text-hint">
            {asOf ? `${fmtDate(asOf)} 收盤價 · 非即時報價` : ''}
          </span>
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

      {/* 摘要數字：一條白底統計列，和交易紀錄底部統計列同一個視覺 */}
      <div className="risk-kpi-strip">
        <Kpi
          label="跌破停損"
          value={summary.breach}
          color={token.colorError}
          hint="收盤價已跌破停損價，需要今天處理"
        />
        <Kpi
          label="接近停損"
          value={summary.near}
          color={token.colorWarning}
          hint="距停損 3% 內，先想好怎麼做"
        />
        <Kpi
          label="未設停損"
          value={summary.noStop}
          color={token.colorPrimary}
          hint="有持倉但沒有停損價，等於沒有風控"
        />
        <Kpi
          label="停損設錯邊"
          value={summary.invalidStop}
          color={token.colorError}
          hint="多單停損高於成本、空單停損低於成本，風險不是正數"
        />
        {summary.noPrice > 0 && (
          <Kpi label="無收盤價" value={summary.noPrice} color={token.colorTextTertiary} />
        )}
        <Kpi
          label="持倉檔數"
          value={summary.openPositions}
          color={token.colorText}
          hint="目前未平倉的部位數"
        />
      </div>

      {/* 主區塊：今日警示（左，寬）＋ 曝險總覽（右，窄） */}
      <div className="risk-main-row">
        <div className="risk-panel risk-main-left">
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
            pagination={
              rows.length > 20
                ? { pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 筆` }
                : false
            }
            locale={{ emptyText }}
            rowClassName={(r) => (r.acknowledged ? 'risk-row-acked' : '')}
            onRow={(r) => ({
              className: 'risk-row-clickable',
              onClick: () => openTrade(r),
            })}
            scroll={{ x: 900 }}
          />
        </div>

        <div className="risk-panel risk-main-right">
          <div className="risk-panel-head">
            <span className="text-subtitle font-serif">曝險總覽</span>
            <Tag color="default">TD-115</Tag>
          </div>
          <div className="risk-coming-soon">
            <AlertOutlined />
            <span>總曝險、持倉 Beta、集中度與族群偏離正在開發中。</span>
            <Button type="link" size="small" onClick={() => navigate('/trades')}>
              先看交易紀錄 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RiskCenter
