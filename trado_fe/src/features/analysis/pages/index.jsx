import React from 'react'
import { Card, Empty, Segmented, Space, Spin, Tag, Tooltip, theme as antdTheme } from 'antd'
import { Area, Line } from '@ant-design/plots'
import { useTheme } from '@/contexts/ThemeContext'
import { useTearsheet, RANGE_OPTIONS, BENCHMARK_OPTIONS } from '../hooks/useTearsheet'
import '../styles/index.scss'

const BENCHMARK_LABELS = { TAIEX: '加權指數', '0050': '元大台灣50' }
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const fmtPct = (v, digits = 2) => {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`
}

const fmtRatio = (v, digits = 2) => (v == null ? '—' : v.toFixed(digits))

const dateLabel = (v) => {
  const d = new Date(v)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const SectionTitle = ({ label }) => <span className="text-subtitle">{label}</span>

/** 滾動指標小圖：三張圖只差資料與格式，抽成一個元件避免複製貼上 */
const RollingChart = ({ label, data, color, axisFormatter, tipFormatter }) => (
  <div>
    <div className="mc-label text-hint">{label}</div>
    <div className="analysis-curve">
      <Line
        data={data}
        xField="date"
        yField="value"
        shapeField="smooth"
        style={{ lineWidth: 2, stroke: color }}
        axis={{
          x: { title: false, labelFormatter: dateLabel },
          y: { title: false, labelFormatter: axisFormatter },
        }}
        tooltip={{
          items: [{ field: 'value', name: label, valueFormatter: tipFormatter }],
        }}
        height={180}
        autoFit
        containerStyle={{ width: '100%', height: 'inherit' }}
      />
    </div>
  </div>
)

/**
 * 單一指標格
 * null = 後端判定樣本不足而不計算 → 顯示「—」並用 tooltip 說明，
 * 不要顯示 0（0 會被讀成「算出來是 0」）。
 */
const MetricCell = ({ label, value, color, hint, dim }) => (
  <div className="analysis-kpi-item">
    <Tooltip title={hint || null}>
      <span className="mc-label text-hint" style={{ cursor: hint ? 'help' : 'default' }}>
        {label}
      </span>
    </Tooltip>
    <span className="analysis-kpi-value fw-600" style={{ color, opacity: dim ? 0.45 : 1 }}>
      {value}
    </span>
  </div>
)

const Analysis = () => {
  const { theme } = useTheme()
  const { token } = antdTheme.useToken()

  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()
  const CLR_NONE = token.colorTextQuaternary

  const pnlColor = (v) => (v == null ? CLR_NONE : v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE)

  const {
    range, setRange,
    benchmark, setBenchmark,
    loading,
    data,
    equityData,
    drawdownData,
    rollingReturnData,
    rollingVolData,
    rollingSharpeData,
    heatmap,
  } = useTearsheet()

  const m = data?.metrics
  const meta = data?.meta
  const benchLabel = BENCHMARK_LABELS[meta?.benchmark] || '基準'
  const rollingWindow = meta?.rollingWindow ?? 60

  const hasData = !!data && data.equity.length >= 2

  // 首次載入時 data 還是 null，先不要閃出「資料不足」的字
  const emptyCard =
    loading && !data ? null : (
      <Card className="analysis-card">
        <Empty
          description={
            meta?.observations === 0
              ? '還沒有交易紀錄，先建立第一筆交易'
              : '這個區間的交易資料不足（少於 2 個交易日），無法計算績效'
          }
        />
      </Card>
    )

  return (
    <div className="Analysis">
      <div className="Analysis-header">
        <div className="Analysis-header-title">
          <span className="text-title font-bold font-serif">績效分析</span>
          {meta?.from && (
            <span className="text-hint">
              {meta.from} ~ {meta.to} · {meta.observations} 個交易日
            </span>
          )}
        </div>
        <Space size={12} wrap>
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
          <Segmented options={BENCHMARK_OPTIONS} value={benchmark} onChange={setBenchmark} />
        </Space>
      </div>

      <Spin spinning={loading}>
        {!hasData ? (
          emptyCard
        ) : (
          <div className="Analysis-body">
            {/* ══════ ① 指標總覽 ══════ */}
            <Card
              className="analysis-card"
              title={
                <div className="useBetween">
                  <SectionTitle label="指標總覽" />
                  <Space size={6}>
                    {meta.missingPriceSymbols?.length > 0 && (
                      <Tooltip
                        title={`${meta.missingPriceSymbols.join('、')} 在區間內沒有收盤價，已用最後成交價評價，這段期間的波動會被低估`}
                      >
                        <Tag color="warning">{meta.missingPriceSymbols.length} 檔缺價</Tag>
                      </Tooltip>
                    )}
                    {!m.sampleSufficient && (
                      <Tooltip title={`少於 ${m.minObservations} 個交易日，波動、Sharpe 等統計量不計算`}>
                        <Tag>樣本不足</Tag>
                      </Tooltip>
                    )}
                  </Space>
                </div>
              }
              styles={{ body: { padding: '12px 16px 16px' } }}
            >
              <div className="analysis-kpi-grid">
                <MetricCell
                  label="總報酬（TWR）"
                  value={fmtPct(m.totalReturn)}
                  color={pnlColor(m.totalReturn)}
                  hint="時間加權報酬，已排除出入金造成的資產跳動"
                />
                <MetricCell
                  label="年化報酬"
                  value={fmtPct(m.annualizedReturn)}
                  color={pnlColor(m.annualizedReturn)}
                  hint={`少於 ${m.minAnnualizedObservations} 個交易日不年化（區間太短，年化會被放大成誤導性的數字）`}
                  dim={m.annualizedReturn == null}
                />
                <MetricCell
                  label="XIRR（資金加權）"
                  value={fmtPct(m.xirr)}
                  color={pnlColor(m.xirr)}
                  hint="把每筆投入的金額與時點都算進去的年化報酬，自帳號第一筆活動起算（不受上方區間影響）。和 TWR 差得多，代表加碼時機對結果影響很大"
                  dim={m.xirr == null}
                />
                <MetricCell
                  label="年化波動"
                  value={fmtPct(m.volatility)}
                  hint="日報酬標準差 × √252"
                  dim={m.volatility == null}
                />
                <MetricCell
                  label="最大回撤"
                  value={fmtPct(m.maxDrawdown)}
                  color={m.maxDrawdown == null ? CLR_NONE : CLR_DOWN}
                  hint={data.maxDrawdownDate ? `谷底出現在 ${data.maxDrawdownDate}` : 'TWR 指數相對前波高點的最大跌幅'}
                  dim={m.maxDrawdown == null}
                />
                <MetricCell
                  label="Sharpe"
                  value={fmtRatio(m.sharpe)}
                  hint="(年化超額報酬) ÷ (年化波動)，無風險利率以 1.5% 計"
                  dim={m.sharpe == null}
                />
                <MetricCell
                  label="Sortino"
                  value={fmtRatio(m.sortino)}
                  hint="只把下行波動放進分母的 Sharpe"
                  dim={m.sortino == null}
                />
                <MetricCell
                  label="Calmar"
                  value={fmtRatio(m.calmar)}
                  hint="年化報酬 ÷ |最大回撤|"
                  dim={m.calmar == null}
                />
                <MetricCell
                  label={`超額報酬（vs ${benchLabel}）`}
                  value={fmtPct(m.excessReturn)}
                  color={pnlColor(m.excessReturn)}
                  hint="總報酬 − 同期基準報酬"
                  dim={m.excessReturn == null}
                />
                <MetricCell label="Beta" value={fmtRatio(m.beta)} hint="對基準的敏感度；1 代表與大盤同步" dim={m.beta == null} />
                <MetricCell
                  label="Alpha"
                  value={fmtPct(m.alpha)}
                  color={pnlColor(m.alpha)}
                  hint="扣掉 Beta 曝險後，基準解釋不了的報酬（年化）"
                  dim={m.alpha == null}
                />
                <MetricCell label="追蹤誤差" value={fmtPct(m.trackingError)} hint="與基準日報酬差的標準差（年化）" dim={m.trackingError == null} />
                <MetricCell label="資訊比率" value={fmtRatio(m.informationRatio)} hint="主動報酬 ÷ 追蹤誤差；> 0.5 算不錯" dim={m.informationRatio == null} />
              </div>
            </Card>

            {/* ══════ ② 累積報酬 vs 基準 ══════ */}
            <Card className="analysis-card" title={<SectionTitle label={`累積報酬 vs ${benchLabel}`} />} styles={{ body: { padding: '12px 16px' } }}>
              <div className="analysis-curve">
                <Line
                  data={equityData}
                  xField="date"
                  yField="value"
                  colorField="series"
                  shapeField="smooth"
                  scale={{
                    color: {
                      domain: ['我的績效', '基準'],
                      range: [theme.primary, CLR_NONE],
                    },
                    y: { nice: true },
                  }}
                  style={{ lineWidth: 2 }}
                  axis={{
                    x: { title: false, labelFormatter: dateLabel },
                    y: { title: false, labelFormatter: (v) => Number(v).toFixed(0) },
                  }}
                  legend={{ color: { position: 'top', layout: { justifyContent: 'flex-end' } } }}
                  tooltip={{
                    items: [
                      {
                        field: 'value',
                        name: '指數（起點 = 100）',
                        valueFormatter: (v) => Number(v).toFixed(2),
                      },
                    ],
                  }}
                  height={280}
                  autoFit
                  containerStyle={{ width: '100%', height: 'inherit' }}
                />
              </div>
            </Card>

            {/* ══════ ③ 回撤 ══════ */}
            <Card
              className="analysis-card"
              title={
                <div className="useBetween">
                  <SectionTitle label="回撤曲線" />
                  <span className="text-hint">
                    最大回撤 {fmtPct(m.maxDrawdown)}
                    {data.maxDrawdownDate && `（${data.maxDrawdownDate}）`}
                  </span>
                </div>
              }
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div className="analysis-curve">
                <Area
                  data={drawdownData}
                  xField="date"
                  yField="value"
                  shapeField="smooth"
                  style={{ fill: CLR_DOWN, fillOpacity: 0.22, stroke: CLR_DOWN, lineWidth: 1.5 }}
                  axis={{
                    x: { title: false, labelFormatter: dateLabel },
                    y: { title: false, labelFormatter: (v) => `${Number(v).toFixed(0)}%` },
                  }}
                  tooltip={{
                    items: [
                      { field: 'value', name: '距前波高點', valueFormatter: (v) => `${Number(v).toFixed(2)}%` },
                    ],
                  }}
                  height={200}
                  autoFit
                  containerStyle={{ width: '100%', height: 'inherit' }}
                />
              </div>
            </Card>

            {/* ══════ ④ 滾動指標 ══════ */}
            <Card
              className="analysis-card"
              title={<SectionTitle label={`滾動 ${rollingWindow} 日指標`} />}
              styles={{ body: { padding: '12px 16px' } }}
            >
              {rollingReturnData.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={`需要超過 ${rollingWindow} 個交易日才能畫滾動指標`}
                />
              ) : (
                <div className="analysis-rolling-grid">
                  <RollingChart
                    label={`滾動 ${rollingWindow} 日報酬`}
                    data={rollingReturnData}
                    color={theme.primary}
                    axisFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    tipFormatter={(v) => `${Number(v).toFixed(2)}%`}
                  />
                  <RollingChart
                    label={`滾動 ${rollingWindow} 日年化波動`}
                    data={rollingVolData}
                    color={token.colorWarning}
                    axisFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    tipFormatter={(v) => `${Number(v).toFixed(2)}%`}
                  />
                  <RollingChart
                    label={`滾動 ${rollingWindow} 日 Sharpe`}
                    data={rollingSharpeData}
                    color={CLR_NONE}
                    axisFormatter={(v) => Number(v).toFixed(1)}
                    tipFormatter={(v) => Number(v).toFixed(2)}
                  />
                </div>
              )}
            </Card>

            {/* ══════ ⑤ 月報酬熱圖 ══════ */}
            <Card
              className="analysis-card"
              title={
                <div className="useBetween">
                  <SectionTitle label="月報酬" />
                  <span className="text-hint">
                    {data.monthlySummary.positiveMonths} / {data.monthlySummary.months} 個月為正
                    {data.monthlySummary.best && ` · 最佳 ${data.monthlySummary.best.label} ${fmtPct(data.monthlySummary.best.return, 1)}`}
                    {data.monthlySummary.worst && ` · 最差 ${data.monthlySummary.worst.label} ${fmtPct(data.monthlySummary.worst.return, 1)}`}
                  </span>
                </div>
              }
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div className="analysis-heatmap">
                <div className="analysis-heatmap-row analysis-heatmap-head">
                  <span className="hm-year">年份</span>
                  {MONTHS.map((mo) => (
                    <span key={mo} className="hm-cell">{mo}月</span>
                  ))}
                  <span className="hm-cell hm-total">全年</span>
                </div>
                {heatmap.map((row) => (
                  <div key={row.year} className="analysis-heatmap-row">
                    <span className="hm-year">{row.year}</span>
                    {row.cells.map((c) => {
                      const color = c.ret == null ? null : c.ret > 0 ? CLR_UP : CLR_DOWN
                      // 熱度隨絕對報酬增加，但封頂 45%，避免文字在深色底上讀不到
                      const alpha = c.ret == null ? 0 : Math.min(8 + Math.abs(c.ret) * 100 * 4, 45)
                      return (
                        <Tooltip
                          key={c.month}
                          title={
                            c.ret == null
                              ? `${c.label}：無資料`
                              : `${c.label} · 本月 ${fmtPct(c.ret, 1)} ｜ ${benchLabel} ${fmtPct(c.bench, 1)} ｜ ${c.tradingDays} 個交易日`
                          }
                        >
                          <span
                            className="hm-cell hm-value"
                            style={{
                              background: color ? `color-mix(in srgb, ${color} ${alpha}%, transparent)` : undefined,
                              color: color || token.colorTextQuaternary,
                            }}
                          >
                            {c.ret == null ? '' : (c.ret * 100).toFixed(1)}
                          </span>
                        </Tooltip>
                      )
                    })}
                    <span className="hm-cell hm-total" style={{ color: pnlColor(row.yearReturn) }}>
                      {fmtPct(row.yearReturn, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </Spin>
    </div>
  )
}

export default Analysis
