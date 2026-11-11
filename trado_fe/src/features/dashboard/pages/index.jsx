import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Segmented, Card, Button, Progress, Rate, Spin, Tag, Tooltip, theme as antdTheme } from 'antd'
import { Column, Line, Scatter } from '@ant-design/plots'
import { useTheme } from '../../../contexts/ThemeContext'
import { useDashboard, fmtMoney, fmtSign, fmtPct } from '../hooks/useDashboard'
import Sparkline from '../components/Sparkline'
import PerfectScrollbar from 'react-perfect-scrollbar'

const SectionTitle = ({ label }) => (
  <span className="text-subtitle">{label}</span>
)

const BENCHMARK_LABELS = { TAIEX: '加權指數', '0050': '元大台灣50' }

/**
 * 單一績效指標格
 * value 為 null 代表後端判定樣本不足而不計算，顯示破折號並用 tooltip 說明原因，
 * 不要顯示 0 —— 0 會被讀成「算出來是 0」。
 */
const MetricCell = ({ label, value, color, hint, dim }) => (
  <div className="perf-kpi-item">
    <Tooltip title={hint || null}>
      <span
        className="mc-label text-hint"
        style={{ cursor: hint ? 'help' : 'default' }}
      >
        {label}
      </span>
    </Tooltip>
    <span
      className="perf-kpi-value fw-600"
      style={{ color, opacity: dim ? 0.45 : 1 }}
    >
      {value}
    </span>
  </div>
)

const Dashboard = () => {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { token } = antdTheme.useToken()

  const root = getComputedStyle(document.documentElement)
  const CLR_UP   = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()
  const CLR_NONE = token.colorTextQuaternary

  const pnlColor = (v) => v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE

  const EMOTION_COLOR = {
    CALM:      token.colorInfo,
    ANXIOUS:   token.colorWarning,
    CONFIDENT: token.colorSuccess,
    GREEDY:    token.colorWarningActive,
    FEARFUL:   token.colorError,
  }

  const {
    periodRange, setPeriodRange,
    benchmark, setBenchmark,
    loading,
    account: acct,
    performance: perf,
    perfDiff,
    strategies,
    strategyChartData,
    discipline,
    trades: filteredTrades,
    scatterData,
    wins, losses,
    avgWin, avgLoss,
    indexDist,
    weeklyTrades,
    perfCurveData,
  } = useDashboard()

  if (!acct || !perf || !discipline) {
    return (
      <div className="Dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  const cashPct   = acct.totalAssets ? Math.round((acct.cashLevel / acct.totalAssets) * 100) : 0
  const risk      = perf.risk
  const trend = acct.assetTrend || []
  const trendDiff = trend.length > 1 ? trend[trend.length - 1] - trend[0] : 0
  const trendClr  = pnlColor(trendDiff)

  return (
    <div className="Dashboard">
      <Spin spinning={loading}>
        <div className="dashboard-top-bar">
          <span className="text-title">儀表板</span>
          <Segmented
            value={periodRange}
            onChange={setPeriodRange}
            options={[
              { label: '本月', value: 'month' },
              { label: 'Q1',   value: 'q1'    },
              { label: 'Q2',   value: 'q2'    },
              { label: 'Q3',   value: 'q3'    },
              { label: 'Q4',   value: 'q4'    },
              { label: '今年', value: 'year'  },
            ]}
          />
        </div>
        <div className="dashboard-main-row">

          {/* ══════ 左側：帳戶狀態（即時快照）══════ */}
          <div className="dashboard-col-left">
            <PerfectScrollbar options={{ suppressScrollX: true }}>
            <Card
              className="dashboard-section-card"
              title={
                <div className="card-title-row">
                  <SectionTitle label="帳戶狀態" />
                  <Tag bordered={false} style={{ marginRight: 0 }}>即時</Tag>
                </div>
              }
              styles={{ body: { padding: '16px' } }}
            >
              <div className="account-status-col">
                <div className="account-status-item account-status-asset">
                  <div className="mc-label text-hint">總資產</div>
                  <div className="hero-value text-h4">
                    {fmtMoney(acct.totalAssets)}<span className="mc-unit text-hint">元</span>
                  </div>
                  {acct.assetTrend && acct.assetTrend.length > 1 && (
                    <Sparkline data={acct.assetTrend} color={trendClr} />
                  )}
                </div>
                <div className="account-status-grid">
                  <div className="account-status-item">
                    <span className="mc-label text-hint">現金水位</span>
                    <div className="account-status-center">
                      {acct.cashLevel != null ? (
                        <Tooltip title={`${fmtMoney(acct.cashLevel)} 元`}>
                          <div style={{ cursor: 'default' }}>
                            <Progress
                              type="dashboard"
                              percent={cashPct}
                              strokeColor={theme.primary}
                              size={72}
                              format={(pct) => <span className="text-hint fw-600">{pct}%</span>}
                            />
                          </div>
                        </Tooltip>
                      ) : (
                        <span className="text-hint">--</span>
                      )}
                    </div>
                  </div>
                  <div className="account-status-item">
                    <span className="mc-label text-hint">持倉中</span>
                    <Tooltip
                      title={
                        <div style={{ fontSize: 12 }}>
                          {acct.positions?.map(p => (
                            <div key={p.symbol} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
                              <span>{p.symbol}</span>
                              <span style={{ color: p.direction === 'long' ? CLR_UP : CLR_DOWN }}>
                                {p.direction === 'long' ? '多' : '空'}
                              </span>
                            </div>
                          ))}
                        </div>
                      }
                    >
                      <div className="account-status-center" style={{ cursor: 'default', flexDirection: 'column', gap: 4 }}>
                        <span className="text-h4 fw-600">{acct.openPositions}<span className="mc-unit text-hint">筆</span></span>
                        <span className="text-hint" style={{ color: CLR_NONE }}>
                          多 {acct.longCount} / 空 {acct.shortCount}
                        </span>
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </Card>

            {/* ══════ 紀律追蹤 ══════ */}
            <Card
              className="dashboard-section-card"
              title={<SectionTitle label="紀律追蹤" />}
              styles={{ body: { padding: '16px' } }}
            >
              <div className="discipline-col">
                {discipline.totalTrades === 0 ? (
                  <div className="empty-hint text-hint">此時段無紀律資料</div>
                ) : (
                  <>
                {/* 自評分數 */}
                <div className="discipline-item">
                  <span className="mc-label text-hint">平均自評</span>
                  <div className="discipline-rating-row">
                    <Rate disabled allowHalf value={discipline.avgRating} style={{ fontSize: 14 }} />
                    <span className="text-body fw-600">{discipline.avgRating}</span>
                  </div>
                  <span className="text-hint">
                    已檢討 {discipline.totalReviewed}/{discipline.totalTrades} 筆
                  </span>
                </div>

                {/* 紀律遵守率 */}
                <div className="discipline-item">
                  <span className="mc-label text-hint">紀律遵守率</span>
                  <div className="discipline-bar-wrap">
                    <div className="discipline-bar">
                      <div
                        className="discipline-bar-pass"
                        style={{
                          flex: discipline.disciplinePass,
                          background: CLR_UP,
                        }}
                      />
                      <div
                        className="discipline-bar-fail"
                        style={{
                          flex: discipline.disciplineFail,
                          background: CLR_DOWN,
                        }}
                      />
                    </div>
                    <span className="text-body fw-600">
                      {discipline.disciplinePass + discipline.disciplineFail > 0
                        ? Math.round((discipline.disciplinePass / (discipline.disciplinePass + discipline.disciplineFail)) * 100)
                        : 0}%
                    </span>
                  </div>
                  <span className="text-hint">
                    遵守 {discipline.disciplinePass} / 違反 {discipline.disciplineFail}
                  </span>
                </div>

                {/* 情緒分佈 */}
                <div className="discipline-item">
                  <span className="mc-label text-hint">交易時情緒</span>
                  <div className="emotion-bar-wrap">
                    <div className="emotion-bar">
                      {discipline.emotions.map(e => (
                        <div
                          key={e.value}
                          className="emotion-bar-seg"
                          style={{ flex: e.count, background: EMOTION_COLOR[e.value] }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="emotion-legend">
                    {discipline.emotions.map(e => (
                      <span key={e.value} className="emotion-legend-item">
                        <span className="emotion-dot" style={{ background: EMOTION_COLOR[e.value] }} />
                        <span className="text-hint">{e.label} {e.count}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 常見失誤 */}
                <div className="discipline-item">
                  <span className="mc-label text-hint">常見失誤</span>
                  <div className="error-list">
                    {discipline.errors.map((e, i) => (
                      <div key={i} className="error-row">
                        <span className="error-label text-hint">{e.label}</span>
                        <span className="error-count fw-600" style={{ color: CLR_DOWN }}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                  </>
                )}
              </div>
            </Card>
            </PerfectScrollbar>
          </div>

          {/* ══════ 右側：時段分析區 ══════ */}
          <div className="dashboard-col-right">
              <PerfectScrollbar className="dashboard-period-cards" options={{ suppressScrollX: true }}>
              {/* ══════ ② 績效 vs 大盤 ══════ */}
              <Card
                className="dashboard-section-card"
                title={
                  <div className="card-title-row">
                    <SectionTitle label="績效 vs 基準" />
                    {perf.observations > 0 && (
                      <Tooltip title={`本期間可用的日報酬樣本數（交易日）`}>
                        <Tag bordered={false} style={{ marginRight: 0, fontSize: 11 }}>
                          {perf.observations} 交易日
                        </Tag>
                      </Tooltip>
                    )}
                    {perf.trades > 0 && (
                      <Tooltip title="本期間已平倉的交易筆數（勝率、盈虧比、獲利因子、期望值都基於這些單）">
                        <Tag bordered={false} style={{ marginRight: 0, fontSize: 11 }}>
                          {perf.trades} 筆
                        </Tag>
                      </Tooltip>
                    )}
                    {perf.trades > 0 && !perf.tradeSampleSufficient && (
                      <Tooltip title={`少於 ${perf.minTradesForConfidence} 筆交易，勝率與盈虧比的抽樣誤差很大，請把區間一起看`}>
                        <Tag color="warning" bordered={false} style={{ marginRight: 0, fontSize: 11 }}>
                          交易樣本少
                        </Tag>
                      </Tooltip>
                    )}
                  </div>
                }
                extra={
                  <Segmented
                    size="small"
                    value={benchmark}
                    onChange={setBenchmark}
                    options={[
                      { label: '加權指數', value: 'TAIEX' },
                      { label: '0050', value: '0050' },
                    ]}
                  />
                }
                styles={{ body: { padding: '16px' } }}
              >
                <div className="perf-card">
                  {/* 頂部：報酬率左右對比 */}
                  <div className="perf-return-row">
                    <div className="perf-return-col">
                      <span className="mc-label text-hint">我的報酬率（TWR）</span>
                      <span className="perf-return-big" style={{ color: perf.myReturn != null ? pnlColor(perf.myReturn) : CLR_NONE }}>
                        {perf.myReturn != null ? fmtPct(perf.myReturn) : '--'}
                      </span>
                      <span className="perf-return-sub fw-600" style={{ color: pnlColor(perf.myPnL) }}>
                        {fmtSign(perf.myPnL)}{fmtMoney(perf.myPnL)}<span className="mc-unit text-hint">元</span>
                      </span>
                    </div>
                    <div className="perf-return-col">
                      <span className="mc-label text-hint">{BENCHMARK_LABELS[perf.benchmark] || '基準'}報酬率</span>
                      <span className="perf-return-big" style={{ color: perf.marketReturn != null ? pnlColor(perf.marketReturn) : CLR_NONE }}>
                        {perf.marketReturn != null ? fmtPct(perf.marketReturn) : '--'}
                      </span>
                      <span className="perf-return-sub fw-600" style={{ color: perfDiff != null ? pnlColor(perfDiff) : CLR_NONE }}>
                        {perfDiff != null ? `超額 ${fmtPct(perfDiff)}` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* 交易統計：看每一筆單的品質 */}
                  <div className="perf-kpi-row">
                    <MetricCell
                      label="勝率"
                      hint={
                        perf.winRateCi?.low != null
                          ? `95% 信賴區間 ${perf.winRateCi.low}% ~ ${perf.winRateCi.high}%（n = ${perf.trades}）`
                          : '尚無已平倉交易'
                      }
                      value={perf.winRate > 0 ? `${perf.winRate.toFixed(1)}%` : '−'}
                      color={perf.winRate > 50 ? CLR_UP : perf.winRate > 0 ? CLR_DOWN : CLR_NONE}
                    />
                    <MetricCell
                      label="盈虧比"
                      hint={`平均獲利 ${fmtMoney(perf.avgWin)} ÷ 平均虧損 ${fmtMoney(perf.avgLoss)}`}
                      value={perf.rrRatio > 0 ? `${perf.rrRatio.toFixed(2)}x` : '−'}
                      color={perf.rrRatio > 1 ? CLR_UP : perf.rrRatio > 0 ? CLR_DOWN : CLR_NONE}
                      dim={perf.rrRatio === 0}
                    />
                    <MetricCell
                      label="獲利因子"
                      hint="總獲利金額 ÷ 總虧損金額，1 以上才代表整體賺錢"
                      value={perf.profitFactor != null ? perf.profitFactor.toFixed(2) : '−'}
                      color={perf.profitFactor != null && perf.profitFactor > 1 ? CLR_UP : perf.profitFactor != null ? CLR_DOWN : CLR_NONE}
                      dim={perf.profitFactor == null}
                    />
                    <MetricCell
                      label="期望值／筆"
                      hint="勝率 × 平均獲利 − 敗率 × 平均虧損：每做一筆平均的期望損益"
                      value={perf.expectancy != null
                        ? <>{fmtSign(perf.expectancy)}{fmtMoney(perf.expectancy)}<span className="mc-unit text-hint">元</span></>
                        : '−'}
                      color={perf.expectancy != null ? pnlColor(perf.expectancy) : CLR_NONE}
                      dim={perf.expectancy == null}
                    />
                  </div>

                  {/* 帳戶風險：看資金實際的波動，用每日淨值算 */}
                  <div className="perf-kpi-row">
                    <MetricCell
                      label="最大回撤"
                      hint="以 TWR 淨值指數計算（已排除出入金），不是資產金額的回撤"
                      color={perf.maxDrawdown != null && perf.maxDrawdown < 0 ? CLR_DOWN : CLR_NONE}
                      value={perf.maxDrawdown != null ? `${perf.maxDrawdown.toFixed(1)}%` : '—'}
                      dim={perf.maxDrawdown == null}
                    />
                    <MetricCell
                      label="年化報酬"
                      hint={perf.annualizedReturn == null
                        ? `樣本需 ≥ ${perf.minAnnualizedObservations} 個交易日才年化，目前 ${perf.observations} 日`
                        : 'TWR 以 252 交易日複利年化'}
                      value={perf.annualizedReturn != null ? fmtPct(perf.annualizedReturn) : '—'}
                      color={perf.annualizedReturn != null ? pnlColor(perf.annualizedReturn) : CLR_NONE}
                      dim={perf.annualizedReturn == null}
                    />
                    <MetricCell
                      label="年化波動"
                      hint={perf.volatility == null
                        ? `樣本需 ≥ ${perf.minObservations} 個交易日，目前 ${perf.observations} 日`
                        : '日報酬標準差 × √252'}
                      value={perf.volatility != null ? `${perf.volatility.toFixed(1)}%` : '—'}
                      color={CLR_NONE}
                      dim={perf.volatility == null}
                    />
                    <MetricCell
                      label="Calmar"
                      hint="年化報酬 ÷ |最大回撤|"
                      value={perf.calmar != null ? perf.calmar.toFixed(2) : '—'}
                      color={perf.calmar != null && perf.calmar > 0 ? CLR_UP : perf.calmar != null ? CLR_DOWN : CLR_NONE}
                      dim={perf.calmar == null}
                    />
                  </div>

                  <div className="perf-kpi-row">
                    <MetricCell
                      label="夏普值"
                      hint={`(日報酬 − 無風險利率) / 日報酬標準差 × √252，無風險利率 1.5%`}
                      value={perf.sharpe != null ? perf.sharpe.toFixed(2) : '—'}
                      color={perf.sharpe != null && perf.sharpe > 1 ? CLR_UP : perf.sharpe != null && perf.sharpe < 0 ? CLR_DOWN : CLR_NONE}
                      dim={perf.sharpe == null}
                    />
                    <MetricCell
                      label="Sortino"
                      hint="只懲罰下檔波動的夏普值"
                      value={perf.sortino != null ? perf.sortino.toFixed(2) : '—'}
                      color={perf.sortino != null && perf.sortino > 1 ? CLR_UP : perf.sortino != null && perf.sortino < 0 ? CLR_DOWN : CLR_NONE}
                      dim={perf.sortino == null}
                    />
                    <MetricCell
                      label="Beta"
                      hint={`對 ${BENCHMARK_LABELS[perf.benchmark] || '基準'} 的敏感度：1 = 與大盤同幅波動`}
                      value={perf.beta != null ? perf.beta.toFixed(2) : '—'}
                      color={CLR_NONE}
                      dim={perf.beta == null}
                    />
                    <MetricCell
                      label="Alpha（年化）"
                      hint={`扣除 beta × ${BENCHMARK_LABELS[perf.benchmark] || '基準'} 報酬後，無法被大盤解釋的超額報酬`}
                      value={perf.alpha != null ? fmtPct(perf.alpha) : '—'}
                      color={perf.alpha != null ? pnlColor(perf.alpha) : CLR_NONE}
                      dim={perf.alpha == null}
                    />
                  </div>

                  <div className="perf-kpi-row">
                    <MetricCell
                      label="追蹤誤差"
                      hint="我的日報酬與基準日報酬之差的標準差 × √252"
                      value={perf.trackingError != null ? `${perf.trackingError.toFixed(1)}%` : '—'}
                      color={CLR_NONE}
                      dim={perf.trackingError == null}
                    />
                    <MetricCell
                      label="資訊比率"
                      hint="主動報酬 ÷ 追蹤誤差，衡量偏離大盤是否划算"
                      value={perf.informationRatio != null ? perf.informationRatio.toFixed(2) : '—'}
                      color={perf.informationRatio != null && perf.informationRatio > 0 ? CLR_UP : perf.informationRatio != null ? CLR_DOWN : CLR_NONE}
                      dim={perf.informationRatio == null}
                    />
                    <MetricCell
                      label="資產回撤"
                      hint="改用資產金額（含出入金影響）計算的回撤，僅供對照；有出入金時會失真"
                      value={perf.assetMaxDrawdown != null ? `${perf.assetMaxDrawdown.toFixed(1)}%` : '—'}
                      color={CLR_NONE}
                      dim={perf.assetMaxDrawdown == null}
                    />
                    <MetricCell
                      label="樣本狀態"
                      hint="樣本不足時，年化與統計類指標一律不計算，避免用 2–3 天推出年化數字"
                      value={perf.annualizationSufficient ? '充足' : perf.sampleSufficient ? '偏短' : '不足'}
                      color={perf.annualizationSufficient ? CLR_NONE : token.colorWarning}
                      dim={false}
                    />
                  </div>

                  {/* 淨值曲線：兩條都從 1.0 起算，看相對成長 */}
                  {perfCurveData.length > 0 && (
                    <div className="perf-curve">
                      <Line
                        data={perfCurveData}
                        xField="date"
                        yField="value"
                        colorField="series"
                        shapeField="smooth"
                        scale={{
                          color: {
                            domain: ['我的淨值', '基準'],
                            range: [theme.primary, CLR_NONE],
                          },
                          y: { nice: true },
                        }}
                        style={{ lineWidth: 2 }}
                        axis={{
                          x: {
                            title: false,
                            labelFormatter: (v) => {
                              const d = new Date(v)
                              return `${d.getMonth() + 1}/${d.getDate()}`
                            },
                          },
                          y: {
                            title: false,
                            labelFormatter: (v) => `${v.toFixed(2)}`,
                          },
                        }}
                        legend={{ color: { position: 'top', layout: { justifyContent: 'flex-end' } } }}
                        tooltip={{
                          items: [
                            { field: 'value', name: '相對淨值', valueFormatter: (v) => Number(v).toFixed(3) },
                          ],
                        }}
                        height={170}
                        autoFit={true}
                      />
                    </div>
                  )}
                </div>
              </Card>

              {/* ══════ ③ + ④ 兩欄 ══════ */}
              <div className="dashboard-two-col">

                {/* ③ 策略績效 */}
                <Card
                  className="dashboard-section-card"
                  title={<SectionTitle label="策略績效" />}
                  styles={{ body: { padding: '16px' } }}
                >
                  {strategies.length > 0 ? (
                    <>
                      <div className="strategy-summary-table">
                        <div className="strategy-table-header">
                          <span>策略</span>
                          <span>累計損益</span>
                          <span>勝率</span>
                          <span>盈虧比</span>
                          <span>筆數</span>
                        </div>
                        <div className="strategy-table-body">
                          {strategies.map((s) => (
                            <div key={s.name} className="strategy-table-row">
                              <span className="fw-600">{s.name}</span>
                              <span className="fw-600" style={{ color: pnlColor(s.pnl) }}>
                                {fmtSign(s.pnl)}{fmtMoney(s.pnl)}
                              </span>
                              <span style={{ color: s.winRate > 50 ? CLR_UP : s.winRate > 0 ? CLR_DOWN : CLR_NONE }}>
                                {s.winRate}%
                              </span>
                              <span style={{ color: s.rrRatio > 1 ? CLR_UP : CLR_DOWN }}>
                                {s.rrRatio}x
                              </span>
                              <span>{s.trades}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <Column
                          data={strategyChartData}
                          xField="name"
                          yField="value"
                          scale={{ x: { padding: 0.6 } }}
                          style={{
                            fill: theme.primary,
                            fillOpacity: 0.8,
                          }}
                          axis={{
                            x: { title: false },
                            y: {
                              title: false,
                              labelFormatter: (v) => v >= 1000 || v <= -1000 ? `${v / 1000}k` : `${v}`,
                            },
                          }}
                          tooltip={{
                            items: [
                              { field: 'value', name: '累計損益', valueFormatter: (v) => `${v > 0 ? '+' : ''}${Number(v).toLocaleString()} 元` },
                            ],
                          }}
                          height={160}
                          autoFit={true}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="empty-hint text-hint">此時段無策略資料</div>
                  )}
                </Card>

                {/* ④ 盈虧分佈 */}
                <Card
                  className="dashboard-section-card"
                  title={<SectionTitle label="盈虧分佈" />}
                  styles={{ body: { padding: '16px' } }}
                >
                  {filteredTrades.length > 0 ? (
                    <>
                      <Scatter
                        data={scatterData}
                        xField="date"
                        yField="pnl"
                        scale={{ x: { type: 'time', tickCount: 4 } }}
                        style={(d) => ({
                          fill: d.pnl >= 0 ? CLR_UP : CLR_DOWN,
                          fillOpacity: 0.65,
                          stroke: d.pnl >= 0 ? CLR_UP : CLR_DOWN,
                          strokeOpacity: 1,
                          lineWidth: 1.5,
                          r: 5,
                        })}
                        axis={{
                          x: {
                            title: false,
                            labelFormatter: (v) => {
                              const d = new Date(v)
                              return `${d.getMonth() + 1}/${d.getDate()}`
                            },
                          },
                          y: {
                            title: false,
                            gridStroke: 'rgba(0,0,0,0.06)',
                            gridLineDash: [4, 4],
                            labelFormatter: (v) => v >= 1000 || v <= -1000 ? `${v / 1000}k` : `${v}`,
                          },
                        }}
                        tooltip={{
                          items: [
                            { field: 'symbol', name: '標的' },
                            { field: 'date', name: '日期', valueFormatter: (v) => {
                              const d = new Date(v)
                              return `${d.getMonth() + 1}/${d.getDate()}`
                            }},
                            { field: 'pnl', name: '損益', valueFormatter: (v) => `${v > 0 ? '+' : ''}${Number(v).toLocaleString()} 元` },
                          ],
                        }}
                        annotations={[
                          { type: 'lineY', data: [0], style: { stroke: 'rgba(0,0,0,0.2)', lineWidth: 1, lineDash: [4, 4] } },
                        ]}
                        height={200}
                        autoFit={true}
                      />
                      <div className="pnl-summary">
                        <div className="pnl-summary-row">
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">平均獲利</span>
                            <span className="text-body fw-600" style={{ color: CLR_UP }}>
                              +{fmtMoney(avgWin)}<span className="mc-unit text-hint">元</span>
                            </span>
                          </div>
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">平均虧損</span>
                            <span className="text-body fw-600" style={{ color: CLR_DOWN }}>
                              −{fmtMoney(Math.abs(avgLoss))}<span className="mc-unit text-hint">元</span>
                            </span>
                          </div>
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">盈虧比</span>
                            <span className="text-body fw-600" style={{ color: avgWin / Math.abs(avgLoss || 1) > 1 ? CLR_UP : CLR_DOWN }}>
                              {(avgWin / Math.abs(avgLoss || 1)).toFixed(2)}x
                            </span>
                          </div>
                        </div>
                        <div className="pnl-summary-row">
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">獲利筆數</span>
                            <span className="text-body fw-600" style={{ color: CLR_UP }}>{wins.length}</span>
                          </div>
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">虧損筆數</span>
                            <span className="text-body fw-600" style={{ color: CLR_DOWN }}>{losses.length}</span>
                          </div>
                          <div className="pnl-summary-item">
                            <span className="mc-label text-hint">勝率</span>
                            <span className="text-body fw-600">
                              {((wins.length / filteredTrades.length) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-hint text-hint">此時段無交易資料</div>
                  )}
                </Card>
              </div>

              {/* ══════ ⑤ 風險單位（R） ══════ */}
              <Card
                className="dashboard-section-card"
                title={
                  <div className="card-title-row">
                    <SectionTitle label="風險單位（R）" />
                    {risk && risk.rTrades > 0 && (
                      <Tooltip
                        title={`R = 每單位盈虧 ÷ 初始風險（進場價到停損價）。本期間 ${risk.rTrades} / ${risk.tradesTotal} 筆已平倉交易算得出 R`}
                      >
                        <Tag bordered={false} style={{ marginRight: 0, fontSize: 11 }}>
                          {risk.rTrades} / {risk.tradesTotal} 筆可計算
                        </Tag>
                      </Tooltip>
                    )}
                  </div>
                }
                styles={{ body: { padding: '16px' } }}
              >
                {!risk || risk.rTrades === 0 ? (
                  <div className="risk-empty">
                    <div className="text-body">
                      本期間 {risk?.tradesTotal || 0} 筆已平倉交易，只有 {risk?.tradesWithStop || 0} 筆設定了停損
                      （設定率{' '}
                      {risk?.tradesTotal ? ((risk.tradesWithStop / risk.tradesTotal) * 100).toFixed(0) : 0}%），算不出 R。
                    </div>
                    <div className="text-hint">
                      停損設定率本身就是紀律指標：沒有停損的交易，虧損沒有上限。填了停損價，才會多出 R 值、R 分布與停損遵守率。
                    </div>
                    <Button size="small" onClick={() => navigate('/trades')}>
                      前往交易頁補上停損價
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="perf-kpi-row">
                      <MetricCell
                        label="平均 R"
                        hint="每筆交易平均賺賠幾個 R。1R = 進場價到停損價的距離"
                        value={<>{risk.avgR > 0 ? '+' : ''}{risk.avgR.toFixed(2)}<span className="mc-unit text-hint">R</span></>}
                        color={pnlColor(risk.avgR)}
                      />
                      <MetricCell
                        label="中位數 R"
                        hint={`${risk.rTrades} 筆的中位數。平均數容易被一兩筆大獲利拉高，中位數看的是「典型的一筆」`}
                        value={<>{risk.medianR > 0 ? '+' : ''}{risk.medianR.toFixed(2)}<span className="mc-unit text-hint">R</span></>}
                        color={pnlColor(risk.medianR)}
                      />
                      <MetricCell
                        label="停損遵守率"
                        hint={`R ≥ −1 的比例：${risk.rTrades - (risk.stopBreaches || 0)} / ${risk.rTrades} 筆。低於 −1 代表實際虧損超過原本設定的風險（停損沒執行或跳空）`}
                        value={`${risk.stopAdherence.toFixed(1)}%`}
                        color={risk.stopAdherence >= 80 ? CLR_UP : CLR_DOWN}
                      />
                      <MetricCell
                        label="停損設定率"
                        hint={`${risk.tradesWithStop} / ${risk.tradesTotal} 筆已平倉交易有填停損價。沒有停損的交易算不出 R，也不知道最大虧損會到哪裡`}
                        value={`${risk.tradesTotal ? ((risk.tradesWithStop / risk.tradesTotal) * 100).toFixed(1) : 0}%`}
                        color={risk.tradesWithStop / (risk.tradesTotal || 1) >= 0.8 ? CLR_UP : CLR_DOWN}
                      />
                      <MetricCell
                        label="最好／最差"
                        hint="本期間單筆交易的最大獲利與最大虧損，以 R 表示"
                        value={
                          <>
                            <span style={{ color: CLR_UP }}>+{risk.bestR.toFixed(1)}</span>
                            <span className="text-hint"> / </span>
                            <span style={{ color: CLR_DOWN }}>{risk.worstR.toFixed(1)}</span>
                            <span className="mc-unit text-hint">R</span>
                          </>
                        }
                        color={CLR_NONE}
                      />
                    </div>
                    <div className="risk-dist">
                      <div className="mc-label text-hint">R 分布：每筆交易落在哪個風險區間</div>
                      <Column
                        data={risk.distribution}
                        xField="label"
                        yField="count"
                        scale={{ y: { nice: true }, x: { padding: 0.4 } }}
                        style={(d) => ({
                          fill: d.key === '0-1' || d.key === '1-2' || d.key === '2-3' || d.key === 'gte3'
                            ? CLR_UP
                            : CLR_DOWN,
                          fillOpacity: 0.85,
                          radiusTopLeft: 2,
                          radiusTopRight: 2,
                        })}
                        axis={{
                          x: { title: false },
                          y: { title: false, tickCount: 4 },
                        }}
                        tooltip={{
                          items: [
                            { field: 'count', name: '交易筆數', valueFormatter: (v) => `${v} 筆` },
                          ],
                        }}
                        height={150}
                        autoFit={true}
                      />
                    </div>
                  </>
                )}
              </Card>

              {/* ══════ ⑥ 交易習慣分析 ══════ */}
              <Card
                className="dashboard-section-card"
                title={<SectionTitle label="交易習慣分析" />}
                styles={{ body: { padding: '16px' } }}
              >
                {filteredTrades.length === 0 ? (
                  <div className="empty-hint text-hint">此時段無交易資料</div>
                ) : (
                  <div className="trade-habit-row">
                    {/* 進場點位分佈（需要大盤資料） */}
                    <div className="trade-habit-col">
                      <div className="trend-chart-label text-hint">進場點位分佈</div>
                      {indexDist.length > 0 ? (
                        <Column
                          data={indexDist.flatMap(d => [
                            { range: d.range, direction: '做多', count: d['做多'] },
                            { range: d.range, direction: '做空', count: d['做空'] },
                          ])}
                          xField="range"
                          yField="count"
                          colorField="direction"
                          group={true}
                          scale={{ color: { domain: ['做多', '做空'], range: [CLR_UP, CLR_DOWN] } }}
                          style={(d) => ({
                            radius: [4, 4, 0, 0],
                            fill: d.direction === '做多' ? CLR_UP : CLR_DOWN,
                            fillOpacity: 0.85,
                            maxWidth: 24,
                          })}
                          axis={{
                            x: { title: false },
                            y: { title: false },
                          }}
                          tooltip={{ items: [{ field: 'count', name: '筆數' }] }}
                          height={200}
                          autoFit={true}
                        />
                      ) : (
                        <div className="empty-hint text-hint" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>暫無大盤資料</div>
                      )}
                    </div>

                    {/* 每週交易量 */}
                    <div className="trade-habit-col">
                      <div className="trend-chart-label text-hint">每週交易量</div>
                      <Column
                        data={weeklyTrades}
                        xField="week"
                        yField="count"
                        colorField="direction"
                        stack={true}
                        scale={{ color: { domain: ['做多', '做空'], range: [CLR_UP, CLR_DOWN] } }}
                        style={(d) => ({
                          radius: [4, 4, 0, 0],
                          fill: d.direction === '做多' ? CLR_UP : CLR_DOWN,
                          fillOpacity: 0.85,
                          maxWidth: 24,
                        })}
                        axis={{
                          x: { title: false },
                          y: { title: false },
                        }}
                        tooltip={{ items: [{ field: 'count', name: '筆數' }] }}
                        height={200}
                        autoFit={true}
                      />
                    </div>
                  </div>
                )}
              </Card>

            </PerfectScrollbar>{/* end dashboard-period-cards */}
          </div>{/* end dashboard-col-right */}
        </div>{/* end dashboard-main-row */}
      </Spin>
    </div>
  )
}

export default Dashboard
