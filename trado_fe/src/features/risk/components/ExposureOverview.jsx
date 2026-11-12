import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Empty, Spin, Table, Tag, Tooltip, theme as antdTheme } from 'antd'
import {
  InfoCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Pie } from '@ant-design/plots'
import RiskKpi from './RiskKpi'

const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString())
const fmtPrice = (v) =>
  v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
const fmtPct = (v, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)
const fmtSignedPct = (v, digits = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`
const fmtDate = (iso) => (iso ? iso.replaceAll('-', '/') : '')

// 總資產動輒六位數，KPI 的副標用「萬」比較好讀
const fmtWan = (v) => {
  if (v == null) return '—'
  return Math.abs(v) >= 10000
    ? `${(v / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })} 萬`
    : Number(v).toLocaleString()
}

const hhiLevel = (h) => (h == null ? '' : h < 0.15 ? '分散' : h <= 0.25 ? '適中' : '集中')

// 圓餅的現金扇區用中性灰，才不會跟多空的紅綠搶眼
const CASH_COLOR = '#bfbfbf'

/** 集中度／族群偏離用的小統計 */
const Stat = ({ label, value, hint, color }) => (
  <Tooltip title={hint || null}>
    <div className="risk-stat">
      <span className="text-hint risk-stat-label">{label}</span>
      <span className="risk-stat-value fw-600" style={{ color }}>
        {value}
      </span>
    </div>
  </Tooltip>
)

/**
 * 風險中心右欄：曝險數字 + 部位曝險表。
 * 資料由頁面層的 useRiskExposure 傳進來，避免左右兩邊各打一次 API。
 */
const ExposureOverview = ({ exposure, tableHeight }) => {
  const navigate = useNavigate()
  const { token } = antdTheme.useToken()
  const { data, loading, error, refresh } = exposure

  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()

  const exposureData = data?.exposure
  const beta = data?.beta
  const stopRisk = data?.stopRisk
  const thresholds = data?.thresholds || {}
  const positions = data?.positions || []

  const betaUnavailable = beta == null || beta.portfolio == null
  const betaOutOfRange =
    !betaUnavailable &&
    (beta.portfolio > thresholds.betaHigh || beta.portfolio < thresholds.betaLow)
  const cashBelowMin =
    exposureData?.cashRatio != null && exposureData.cashRatio < thresholds.cashMin
  const stopOverBudget =
    stopRisk?.ratio != null && stopRisk.ratio > thresholds.stopRiskMax

  const columns = [
    {
      title: '標的',
      dataIndex: 'symbol',
      width: 120,
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
    { title: '股數', dataIndex: 'shares', width: 64, align: 'right', render: fmtInt },
    { title: '均價', dataIndex: 'avgPrice', width: 80, align: 'right', render: fmtPrice },
    {
      title: '收盤',
      dataIndex: 'currentPrice',
      width: 80,
      align: 'right',
      render: (v, r) =>
        v == null ? (
          <Tooltip title="沒有收盤價，市值以成本計算">
            <span className="text-hint">無報價</span>
          </Tooltip>
        ) : (
          <Tooltip title={`收盤日 ${fmtDate(r.priceDate)}`}>
            <span className="fw-600">{fmtPrice(v)}</span>
          </Tooltip>
        ),
    },
    {
      title: (
        <Tooltip title="最新收盤價 × 股數；空單為負值">
          <span className="risk-th-help">市值</span>
        </Tooltip>
      ),
      dataIndex: 'marketValue',
      width: 96,
      align: 'right',
      render: (v) => (
        <span className="fw-600" style={{ color: v < 0 ? CLR_DOWN : undefined }}>
          {v < 0 ? '−' : ''}
          {Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: (
        <Tooltip title="|市值| ÷ 總資產。空單與多單同樣會稀釋其他部位的權重">
          <span className="risk-th-help">權重</span>
        </Tooltip>
      ),
      dataIndex: 'weight',
      width: 64,
      align: 'right',
      render: fmtPct,
    },
    {
      title: (
        <Tooltip title={`最近 ${beta?.windowDays ?? 60} 個交易日日報酬對 ${beta?.benchmark ?? 'TAIEX'} 迴歸。樣本不足顯示「資料不足」，不是 0`}>
          <span className="risk-th-help">Beta</span>
        </Tooltip>
      ),
      dataIndex: 'beta',
      width: 64,
      align: 'right',
      render: (v) =>
        v == null ? <span className="text-hint">資料不足</span> : <span className="fw-600">{v.toFixed(2)}</span>,
    },
    {
      title: (
        <Tooltip title="市值權重 × beta。空單為負值，會抵銷大盤波動；加總即持倉 beta">
          <span className="risk-th-help">Beta 貢獻</span>
        </Tooltip>
      ),
      dataIndex: 'betaContribution',
      width: 80,
      align: 'right',
      render: (v) =>
        v == null ? (
          <span className="text-hint">—</span>
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {v > 0 ? '+' : ''}
            {v.toFixed(3)}
          </span>
        ),
    },
    {
      title: '停損',
      dataIndex: 'stopLoss',
      width: 120,
      align: 'right',
      render: (v, r) => {
        if (v == null) return <span className="text-hint">未設定</span>
        if (r.stopRiskAmount == null) {
          return (
            <Tooltip title="停損在成本的另一側，最大虧損沒有上限，不計入總停損風險">
              <span className="fw-600">
                {fmtPrice(v)}
                <Tag color="volcano" style={{ marginInlineStart: 4, marginInlineEnd: 0 }}>
                  設錯邊
                </Tag>
              </span>
            </Tooltip>
          )
        }
        return (
          <Tooltip title={`若跌到停損價出場，預估虧損 ${Number(r.stopRiskAmount).toLocaleString()}`}>
            <span className="fw-600">{fmtPrice(v)}</span>
          </Tooltip>
        )
      },
    },
  ]

  // 表身高度預設由頁面統一給（左右兩張表才會一樣高）；單獨使用時才自己算
  const bodyHeight = tableHeight ?? Math.max(160, Math.min(320, positions.length * 39 + 4))

  if (error && !data) {
    return (
      <div className="risk-panel risk-section-empty risk-area-placeholder">
        <Alert
          type="error"
          showIcon
          message="曝險資料載入失敗"
          description={error?.msg || error?.message || '請稍後再試'}
          action={
            <Button size="small" onClick={refresh}>
              重試
            </Button>
          }
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="risk-panel risk-section-empty risk-area-placeholder">
        <Spin />
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="risk-panel risk-section-empty risk-area-placeholder">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="目前沒有未平倉部位，沒有可計算的曝險" />
      </div>
    )
  }

  // 資金運用甜甜圈：多單／空單／現金。
  // 分母刻意用「多 + |空| + 現金」，不是總資產——空單市值是負的，畫成扇區會讓三片加總超過 100%，
  // 只有沒有空單時兩個分母才相等。
  const donutParts = [
    { type: '多單', value: Math.max(exposureData?.longValue ?? 0, 0), color: CLR_UP },
    { type: '空單', value: Math.abs(exposureData?.shortValue ?? 0), color: CLR_DOWN },
    { type: '現金', value: Math.max(data?.account?.cashBalance ?? 0, 0), color: CASH_COLOR },
  ].filter((d) => d.value > 0)
  const donutTotal = donutParts.reduce((s, d) => s + d.value, 0)

  const donutConfig = {
    data: donutParts,
    angleField: 'value',
    colorField: 'type',
    scale: { color: { range: donutParts.map((d) => d.color) } },
    // 環做細一點，中間留白放淨曝險
    radius: 0.92,
    innerRadius: 0.7,
    legend: false,
    label: false,
    tooltip: {
      items: [{ field: 'value', name: '金額', valueFormatter: (v) => fmtWan(v) }],
    },
    width: 168,
    height: 168,
  }

  return (
    <>
      {/* 曝險數字：跟今日概況同一個區塊樣式 */}
      <div className="risk-summary risk-area-summary-r">
        <div className="risk-summary-head">
          <span className="text-subtitle font-serif">曝險總覽</span>
          <span className="risk-summary-tools">
            <span className="text-hint">{fmtDate(data.asOf)} 收盤價 · 非即時報價</span>
            <Tooltip title="重新計算曝險與 beta">
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                onClick={refresh}
                loading={loading}
              />
            </Tooltip>
          </span>
        </div>
        {/* 左邊數字、右邊甜甜圈；圓餅只吃既有空白，面板高度還是由左邊今日概況決定 */}
        <div className="risk-summary-body">
          <div className="risk-summary-list">
            <RiskKpi
              label="淨曝險"
              value={fmtPct(exposureData?.netRatio)}
              hint="(多單市值 − 空單市值) ÷ 總資產。代表淨方向的市場敏感度"
              sub={`多 ${fmtWan(exposureData?.longValue)} · 空 ${fmtWan(exposureData?.shortValue)}`}
            />
            <RiskKpi
              label="毛曝險"
              value={fmtPct(exposureData?.grossRatio)}
              hint="(多單市值 + 空單市值) ÷ 總資產。不管方向，全部押下去的規模"
              sub={`持倉市值 ${fmtWan(exposureData?.grossValue)}`}
            />
            <RiskKpi
              label="現金比重"
              value={fmtPct(exposureData?.cashRatio)}
              status={cashBelowMin ? 'warning' : 'neutral'}
              hint={`現金 ÷ 總資產。v1 下限 ${fmtPct(thresholds.cashMin, 0)}`}
              sub={`現金 ${fmtWan(data?.account?.cashBalance)}`}
            />
            <RiskKpi
              label="持倉 beta"
              value={betaUnavailable ? '資料不足' : beta.portfolio.toFixed(2)}
              status={betaOutOfRange ? 'warning' : 'neutral'}
              valueSize={betaUnavailable ? 18 : undefined}
              hint={
                betaUnavailable
                  ? `需要至少 ${beta?.minObservations ?? 30} 組與 ${beta?.benchmark ?? 'TAIEX'} 的共同日報酬才算得出來；部分持倉歷史價不足`
                  : `${beta.windowDays} 個交易日日報酬對 ${beta.benchmark} 迴歸，再依市值權重加總。${
                      beta.portfolio > thresholds.betaHigh
                        ? `高於 ${thresholds.betaHigh}，波動會被放大`
                        : beta.portfolio < thresholds.betaLow
                          ? `低於 ${thresholds.betaLow}，多頭行情會落後大盤`
                          : `落在 ${thresholds.betaLow}–${thresholds.betaHigh} 的正常區間`
                    }`
              }
              sub={
                betaUnavailable
                  ? `指數樣本 ${beta?.tradingDays ?? 0} 天`
                  : `涵蓋 ${fmtPct(beta.coverage, 0)} 毛曝險`
              }
            />
            <RiskKpi
              label="總停損風險"
              value={stopRisk?.ratio == null ? '—' : fmtPct(stopRisk.ratio, 2)}
              status={stopOverBudget ? 'warning' : 'neutral'}
              hint={`Σ(成本 − 停損) × 股數 ÷ 總資產。v1 上限 ${fmtPct(thresholds.stopRiskMax, 0)}；沒有有效停損的部位不計入`}
              sub={
                stopRisk?.uncoveredPositions > 0
                  ? `約 ${fmtWan(stopRisk.total)} 元 · ${stopRisk.uncoveredPositions} 筆未設停損`
                  : `約 ${fmtWan(stopRisk?.total)} 元`
              }
            />
            <RiskKpi
              label="總資產"
              value={fmtWan(data?.account?.totalAssets)}
              hint="現金 + 持倉市值，是上面所有比例的分母"
              sub={`現金 ${fmtWan(data?.account?.cashBalance)} · 持倉 ${fmtWan(data?.account?.positionsValue)}`}
            />
          </div>

          {/* 資金運用甜甜圈：至少兩塊才畫得成圓餅（只有現金或只有多單時不畫） */}
          {donutParts.length >= 2 && (
            <div className="risk-summary-chart">
              <div className="risk-donut">
                <Pie {...donutConfig} />
                <div className="risk-donut-center">
                  <span className="risk-donut-center-label">淨曝險</span>
                  <span className="risk-donut-center-value">{fmtPct(exposureData?.netRatio)}</span>
                </div>
              </div>
              <Tooltip title="分母＝多單市值＋空單市值＋現金（資金運用）。有空單時會大於總資產，所以不是資產比重">
                <div className="risk-donut-legend">
                  {donutParts.map((d) => (
                    <span className="risk-donut-legend-item" key={d.type}>
                      <i style={{ background: d.color }} />
                      {d.type} {fmtPct(d.value / donutTotal, 0)}
                    </span>
                  ))}
                </div>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* 部位明細 */}
      <div className="risk-panel risk-area-panel-r">
        <div className="risk-panel-head">
          <span className="text-subtitle font-serif">部位曝險</span>
          <span className="text-hint">點列開啟交易詳情</span>
        </div>
        <Table
          rowKey="tradeId"
          size="small"
          columns={columns}
          dataSource={positions}
          loading={loading && positions.length === 0}
          pagination={false}
          onRow={(r) => ({
            className: 'risk-row-clickable',
            onClick: () => navigate(`/trades?tradeId=${r.tradeId}`),
          })}
          // 跟交易紀錄一樣：表格自己捲、表頭固定，頁面不要被部位數拉長
          scroll={{ x: 772, y: bodyHeight }}
        />
        {/* 沒有有效停損的部位：不計入總停損風險，但不能就這樣消失在表格裡 */}
        {data.noStopPositions.length > 0 && (
          <div className="risk-nostop">
            <div className="risk-nostop-head">
              <WarningOutlined style={{ color: token.colorWarning }} />
              <span>
                <span className="fw-600">{data.noStopPositions.length} 筆</span>
                持倉沒有有效停損，未計入總停損風險
              </span>
            </div>
            <div className="risk-nostop-list">
              {data.noStopPositions.map((p) => (
                <Tooltip
                  key={p.tradeId}
                  title={`${
                    p.reason === 'invalid_stop' ? '停損設在成本的另一側' : '沒有填停損價'
                  }；市值 ${fmtWan(Math.abs(p.marketValue))}，點擊開啟交易詳情`}
                >
                  <span
                    className="risk-nostop-chip"
                    onClick={() => navigate(`/trades?tradeId=${p.tradeId}`)}
                  >
                    {p.symbol}
                    <span className="text-hint"> × {Number(p.shares).toLocaleString()}</span>
                    {p.reason === 'invalid_stop' && <Tag color="volcano">設錯邊</Tag>}
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * 風險中心下排：集中度、族群偏離、建議三欄。
 * 沒有曝險資料時整排不渲染，避免留下三個空殼。
 */
export const ExposureAnalysis = ({ exposure }) => {
  const navigate = useNavigate()
  const { token } = antdTheme.useToken()
  const { data } = exposure

  const positions = data?.positions || []
  const concentration = data?.concentration
  const suggestions = data?.suggestions || []

  // 族群偏離：依「離目標多遠」排序，偏最多的先看
  const sectorRows = useMemo(() => {
    const categories = data?.sectors?.categories || []
    return categories
      .filter((c) => c.targetRatio != null || (c.actualRatio || 0) > 0)
      .sort((a, b) => Math.abs(b.deltaRatio ?? 0) - Math.abs(a.deltaRatio ?? 0))
  }, [data])

  if (!data || positions.length === 0) return null

  return (
    <div className="risk-triple">
      {/* 集中度 */}
      <div className="risk-panel">
        <div className="risk-panel-head">
          <span className="text-subtitle font-serif">集中度</span>
          <span className="text-hint">同一代號合併</span>
        </div>
        <div className="risk-card-body">
          <div className="risk-stat-grid">
            <Stat label="Top 1" value={fmtPct(concentration?.top1)} hint="最大單一持股佔總資產" />
            <Stat label="Top 3" value={fmtPct(concentration?.top3)} />
            <Stat label="Top 5" value={fmtPct(concentration?.top5)} />
            <Stat
              label="HHI"
              value={concentration?.hhi == null ? '—' : concentration.hhi.toFixed(3)}
              hint="持股權重的平方和。0.15 以下分散、0.25 以上集中"
              color={concentration?.hhi > 0.25 ? token.colorWarning : undefined}
            />
          </div>
          <div className="risk-bar-list">
            {(concentration?.holdings || []).slice(0, 5).map((h) => (
              <div className="risk-bar-row" key={h.symbol}>
                <span className="risk-bar-label">{h.symbol}</span>
                <div className="risk-bar-track">
                  <div
                    className="risk-bar-fill"
                    style={{
                      width: `${Math.min((h.weight || 0) * 100, 100)}%`,
                      background: token.colorPrimary,
                    }}
                  />
                </div>
                <span className="risk-bar-value">{fmtPct(h.weight)}</span>
              </div>
            ))}
          </div>
          {concentration?.hhi != null && (
            <div className="risk-card-foot text-hint">
              目前偏{hhiLevel(concentration.hhi)}（HHI {concentration.hhi.toFixed(3)}）
            </div>
          )}
        </div>
      </div>

      {/* 族群偏離 */}
      <div className="risk-panel">
        <div className="risk-panel-head">
          <span className="text-subtitle font-serif">族群偏離</span>
          <span className="text-hint">實際 vs 目標</span>
        </div>
        <div className="risk-card-body">
          {sectorRows.length === 0 ? (
            <div className="risk-card-foot">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="尚未設定族群與目標比重"
              />
              <Button type="link" size="small" onClick={() => navigate('/stock-categories')}>
                去設定族群 →
              </Button>
            </div>
          ) : (
            <div className="risk-bar-list risk-bar-list--sector">
              {sectorRows.map((c) => {
                const over = (c.deltaRatio ?? 0) > 0
                return (
                  <div className="risk-bar-row" key={c.id}>
                    <span className="risk-bar-label" title={c.name}>
                      {c.name}
                    </span>
                    <div className="risk-bar-track">
                      <div
                        className="risk-bar-fill"
                        style={{
                          width: `${Math.min((c.actualRatio || 0) * 100, 100)}%`,
                          background: c.color || token.colorPrimary,
                        }}
                      />
                      {c.targetRatio != null && (
                        <div
                          className="risk-bar-target"
                          style={{ left: `${Math.min(c.targetRatio * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    <Tooltip
                      title={
                        c.targetRatio == null
                          ? `實際 ${fmtPct(c.actualRatio)}，未設目標`
                          : `實際 ${fmtPct(c.actualRatio)} · 目標 ${fmtPct(c.targetRatio)}`
                      }
                    >
                      <span
                        className="risk-bar-value fw-600"
                        style={{ color: over ? token.colorWarning : token.colorPrimary }}
                      >
                        {fmtSignedPct(c.deltaRatio)}
                      </span>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          )}
          {sectorRows.length > 0 && data?.sectors?.unclassified != null && (
            <div className="risk-card-foot text-hint">
              {data.sectors.unclassified.actualRatio > 0
                ? `未分類持股 ${fmtPct(data.sectors.unclassified.actualRatio)}，未列入目標比較`
                : '所有持股都已歸類'}
            </div>
          )}
        </div>
      </div>

      {/* 建議：規則式，每條都對得回一個門檻與實際數字 */}
      <div className="risk-panel">
        <div className="risk-panel-head">
          <span className="text-subtitle font-serif">建議</span>
          <span className="text-hint">依固定門檻</span>
        </div>
        {suggestions.length === 0 ? (
          <div className="risk-section-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="目前沒有超過門檻的項目" />
          </div>
        ) : (
          <ul className="risk-suggestion-list">
            {suggestions.map((s, i) => (
              <li
                key={`${s.code}-${i}`}
                className={`risk-suggestion risk-suggestion--${s.level}`}
              >
                {s.level === 'warn' ? (
                  <WarningOutlined
                    className="risk-suggestion-icon"
                    style={{ color: token.colorWarning }}
                  />
                ) : (
                  <InfoCircleOutlined
                    className="risk-suggestion-icon"
                    style={{ color: token.colorInfo }}
                  />
                )}
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ExposureOverview
