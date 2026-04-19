import React from 'react'
import { Segmented, Card, Progress, Rate, Spin, Tag, Tooltip, theme as antdTheme } from 'antd'
import { Column, Scatter } from '@ant-design/plots'
import { useTheme } from '../../../contexts/ThemeContext'
import { useDashboard, fmtMoney, fmtSign, fmtPct } from '../hooks/useDashboard'
import Sparkline from '../components/Sparkline'
import PerfectScrollbar from 'react-perfect-scrollbar'

const SectionTitle = ({ label }) => (
  <span className="text-subtitle">{label}</span>
)

const Dashboard = () => {
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
  } = useDashboard()

  if (!acct || !perf || !discipline) {
    return (
      <div className="Dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  const cashPct   = acct.totalAssets ? Math.round((acct.cashLevel / acct.totalAssets) * 100) : 0
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
                title={<SectionTitle label="績效 vs 大盤" />}
                styles={{ body: { padding: '16px' } }}
              >
                <div className="perf-card">
                  {/* 頂部：報酬率左右對比 */}
                  <div className="perf-return-row">
                    <div className="perf-return-col">
                      <span className="mc-label text-hint">我的報酬率</span>
                      <span className="perf-return-big" style={{ color: perf.myReturn != null ? pnlColor(perf.myReturn) : CLR_NONE }}>
                        {perf.myReturn != null ? fmtPct(perf.myReturn) : '--'}
                      </span>
                      <span className="perf-return-sub fw-600" style={{ color: pnlColor(perf.myPnL) }}>
                        {fmtSign(perf.myPnL)}{fmtMoney(perf.myPnL)}<span className="mc-unit text-hint">元</span>
                      </span>
                    </div>
                    <div className="perf-return-col">
                      <span className="mc-label text-hint">大盤報酬率</span>
                      <span className="perf-return-big" style={{ color: perf.marketReturn != null ? pnlColor(perf.marketReturn) : CLR_NONE }}>
                        {perf.marketReturn != null ? fmtPct(perf.marketReturn) : '--'}
                      </span>
                      <span className="perf-return-sub fw-600" style={{ color: perfDiff != null ? pnlColor(perfDiff) : CLR_NONE }}>
                        {perfDiff != null ? `超額 ${fmtPct(perfDiff)}` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* 底部：KPI 一排 */}
                  <div className="perf-kpi-row">
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">勝率</span>
                      <span className="perf-kpi-value fw-600" style={{ color: perf.winRate > 50 ? CLR_UP : perf.winRate > 0 ? CLR_DOWN : CLR_NONE }}>
                        {perf.winRate > 0 ? `${perf.winRate.toFixed(1)}%` : '−'}
                      </span>
                    </div>
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">盈虧比</span>
                      <span className="perf-kpi-value fw-600" style={{ color: perf.rrRatio > 1 ? CLR_UP : perf.rrRatio > 0 ? CLR_DOWN : CLR_NONE }}>
                        {perf.rrRatio > 0 ? `${perf.rrRatio.toFixed(2)}x` : '−'}
                      </span>
                    </div>
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">夏普值</span>
                      <span className="perf-kpi-value fw-600" style={{ color: perf.sharpe > 1 ? CLR_UP : perf.sharpe > 0 ? CLR_NONE : perf.sharpe < 0 ? CLR_DOWN : CLR_NONE }}>
                        {perf.trades > 0 ? perf.sharpe.toFixed(2) : '−'}
                      </span>
                    </div>
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">筆數</span>
                      <span className="perf-kpi-value fw-600">
                        {perf.trades > 0 ? `${perf.trades} 筆` : '−'}
                      </span>
                    </div>
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">平均損益</span>
                      <span className="perf-kpi-value fw-600" style={{ color: pnlColor(perf.avgPnl) }}>
                        {perf.trades > 0 ? <>{fmtSign(perf.avgPnl)}{fmtMoney(perf.avgPnl)}<span className="mc-unit text-hint">元</span></> : '−'}
                      </span>
                    </div>
                    <div className="perf-kpi-item">
                      <span className="mc-label text-hint">最大回撤</span>
                      <span className="perf-kpi-value fw-600" style={{ color: perf.maxDrawdown < 0 ? CLR_DOWN : CLR_NONE }}>
                        {perf.maxDrawdown < 0 ? `${perf.maxDrawdown.toFixed(1)}%` : '−'}
                      </span>
                    </div>
                  </div>
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

              {/* ══════ ⑤ 交易習慣分析 ══════ */}
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
