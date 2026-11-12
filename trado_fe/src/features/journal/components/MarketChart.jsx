import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'

/**
 * 大盤 K 線 + 成交量 + 多空帶
 *
 * 多空不是圖表套件的一條 series，而是一層疊在 K 線圖上的透明 canvas：
 * 每次可見區間變動時，用 timeScale().timeToCoordinate() 把每個交易日
 * 換成 x 座標再重畫，因此滾動、縮放都會跟著對齊。
 * 有寫日誌的交易日會顯示「整欄淡色底 + 圖表底部實心色條」，一眼看出哪幾天有記錄。
 *
 * 顏色沿用全站語意（--color-up / --color-down），不另外定義一套紅綠。
 */

const BAND_HEIGHT = 8
const TOOLTIP_WIDTH = 240
const TINT_ALPHA = 0.1

const VIEW_LABEL = { bull: '多', neutral: '中性', bear: '空' }

/** 均線選項；顏色刻意跟多空紅綠分開，避免看圖時混淆 */
const MA_DEFS = [
  { key: '5', label: 'MA5', color: '#f59e0b' },
  { key: '10', label: 'MA10', color: '#3b82f6' },
  { key: '20', label: 'MA20', color: '#a855f7' },
  { key: '60', label: 'MA60', color: '#14b8a6' },
]
const MA_STORAGE_KEY = 'trado.journal.ma'

/** 簡易移動平均：不足天數的日子不畫點 */
const computeMA = (rows, period) => {
  const out = []
  let sum = 0
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i].close
    if (i >= period) sum -= rows[i - period].close
    if (i >= period - 1) out.push({ time: rows[i].date, value: +(sum / period).toFixed(2) })
  }
  return out
}

const readActiveMA = () => {
  try {
    const raw = localStorage.getItem(MA_STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : null
    if (Array.isArray(arr)) return arr.filter((k) => MA_DEFS.some((d) => d.key === k))
  } catch {
    /* localStorage 不可用時用預設值 */
  }
  return ['20']
}

const cssVar = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${y}/${m}/${d}`
}

const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)

const MarketChart = ({
  rows = [],
  entriesByDate,
  nextChangePctByDate,
  onSelectDate,
  height = 320,
}) => {
  const wrapRef = useRef(null)
  const chartElRef = useRef(null)
  const ribbonRef = useRef(null)
  const chartRef = useRef(null)
  const candleRef = useRef(null)
  const volumeRef = useRef(null)
  const drawRef = useRef(() => {})
  const rowsRef = useRef(rows)
  const entriesRef = useRef(entriesByDate)
  const nextRef = useRef(nextChangePctByDate)
  const selectRef = useRef(onSelectDate)
  const fittedRef = useRef(false)
  const maSeriesRef = useRef(new Map())
  const [hover, setHover] = useState(null)
  const [activeMA, setActiveMA] = useState(readActiveMA)

  rowsRef.current = rows
  entriesRef.current = entriesByDate
  nextRef.current = nextChangePctByDate
  selectRef.current = onSelectDate

  // ── 多空帶重繪 ──────────────────────────────────────────
  const drawRibbon = useCallback(() => {
    const chart = chartRef.current
    const canvas = ribbonRef.current
    if (!chart || !canvas) return

    const ts = chart.timeScale()
    const width = Math.round(ts.width())
    const axisHeight = typeof ts.height === 'function' ? ts.height() : 0
    const paneHeight = Math.round((chartElRef.current?.clientHeight || 0) - axisHeight)
    if (width <= 0 || paneHeight <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${width}px`
    canvas.style.height = `${paneHeight}px`
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(paneHeight * dpr)

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, paneHeight)

    const barSpacing = ts.options().barSpacing || 6
    const cellW = Math.max(2, Math.min(barSpacing * 0.8, 18))
    const bandY = paneHeight - BAND_HEIGHT - 1

    const up = cssVar('--color-up', '#38a169')
    const down = cssVar('--color-down', '#cf1322')
    const neutral = cssVar('--text-secondary', '#999')

    let prevView = null
    for (const row of rowsRef.current || []) {
      const entry = entriesRef.current?.get(row.date)
      if (!entry) continue // 未寫＝空白，不畫；也不重置 prevView（要跟前一篇「有寫的」比）

      const x = ts.timeToCoordinate(row.date)
      if (x == null) continue

      const color = entry.view === 'bull' ? up : entry.view === 'bear' ? down : neutral

      // 整欄淡色底：一眼看出這天有日誌，又不會蓋住 K 棒
      ctx.globalAlpha = TINT_ALPHA
      ctx.fillStyle = color
      ctx.fillRect(x - cellW / 2, 0, cellW, bandY - 2)

      // 圖表底部實心色條：滾動縮放時最明顯的定位點
      ctx.globalAlpha = 0.9
      ctx.fillRect(x - cellW / 2, bandY, cellW, BAND_HEIGHT)

      // 方向跟前一篇不同 → 一條淡色直線標出轉折
      if (prevView && prevView !== entry.view) {
        ctx.globalAlpha = 0.25
        ctx.fillStyle = '#000'
        ctx.fillRect(x - cellW / 2 - 0.75, 0, 1.5, bandY + BAND_HEIGHT)
      }
      ctx.globalAlpha = 1
      prevView = entry.view
    }
  }, [])

  drawRef.current = drawRibbon

  // ── 初始化圖表 ──────────────────────────────────────────
  useEffect(() => {
    if (!chartElRef.current) return

    const up = cssVar('--color-up', '#38a169')
    const down = cssVar('--color-down', '#cf1322')

    const maSeries = maSeriesRef.current

    const chart = createChart(chartElRef.current, {
      width: chartElRef.current.clientWidth,
      height,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8c8c8c',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(0, 0, 0, 0.1)' },
      timeScale: {
        borderColor: 'rgba(0, 0, 0, 0.1)',
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
      handleScroll: { vertTouchDrag: false },
    })

    const candle = chart.addCandlestickSeries({
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
    })
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.3 } })

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candle
    volumeRef.current = volume

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => drawRef.current())
    chart.timeScale().subscribeVisibleTimeRangeChange(() => drawRef.current())

    const observer = new ResizeObserver(() => {
      if (!chartElRef.current) return
      chart.applyOptions({ width: chartElRef.current.clientWidth })
      drawRef.current()
    })
    observer.observe(chartElRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      maSeries.clear()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 高度變化
  useEffect(() => {
    chartRef.current?.applyOptions({ height })
  }, [height])

  // ── 套用資料 ────────────────────────────────────────────
  useEffect(() => {
    if (!candleRef.current) return
    const bars = rows.map((r) => ({
      time: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    }))
    candleRef.current.setData(bars)
    volumeRef.current?.setData(
      rows.map((r) => ({ time: r.date, value: r.volume ?? 0 })),
    )

    if (bars.length > 0) {
      if (!fittedRef.current) {
        fittedRef.current = true
        const from = Math.max(0, bars.length - 90)
        chartRef.current?.timeScale().setVisibleLogicalRange({ from, to: bars.length + 2 })
      }
      drawRef.current()
    }
  }, [rows])

  // 均線：依開關建立／移除 series，資料換了就地更新
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const map = maSeriesRef.current

    for (const [key, series] of map) {
      if (!activeMA.includes(key)) {
        chart.removeSeries(series)
        map.delete(key)
      }
    }

    for (const def of MA_DEFS) {
      if (!activeMA.includes(def.key)) continue
      let series = map.get(def.key)
      if (!series) {
        series = chart.addLineSeries({
          color: def.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        map.set(def.key, series)
      }
      series.setData(computeMA(rows, Number(def.key)))
    }

    drawRef.current()
    try {
      localStorage.setItem(MA_STORAGE_KEY, JSON.stringify(activeMA))
    } catch {
      /* 存不進去就算了，不影響看圖 */
    }
  }, [activeMA, rows])

  const toggleMA = (key) => {
    setActiveMA((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      return next.sort((a, b) => Number(a) - Number(b))
    })
  }

  // 日誌增刪改 → 多空帶跟著換色
  useEffect(() => {
    drawRef.current()
  }, [entriesByDate])

  // ── 游標 / 點擊 ─────────────────────────────────────────
  const nearestRow = useCallback((clientX) => {
    const chart = chartRef.current
    const canvas = ribbonRef.current
    if (!chart || !canvas || rowsRef.current.length === 0) return null

    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const ts = chart.timeScale()
    const barSpacing = ts.options().barSpacing || 6

    let best = null
    let bestDist = Infinity
    for (const row of rowsRef.current) {
      const cx = ts.timeToCoordinate(row.date)
      if (cx == null) continue
      const dist = Math.abs(cx - x)
      if (dist < bestDist) {
        bestDist = dist
        best = { row, x: cx }
      }
    }
    return bestDist <= Math.max(barSpacing, 4) ? best : null
  }, [])

  const handleMove = (e) => {
    const found = nearestRow(e.clientX)
    if (!found) {
      if (hover) setHover(null)
      return
    }
    const entry = entriesRef.current?.get(found.row.date) || null
    setHover((prev) =>
      prev && prev.row.date === found.row.date && prev.entry === entry
        ? prev
        : { ...found, entry },
    )
  }

  const handleClick = (e) => {
    const found = nearestRow(e.clientX)
    if (found) selectRef.current?.(found.row.date)
  }

  const wrapWidth = wrapRef.current?.clientWidth || 0
  const tipLeft = hover && wrapWidth
    ? Math.min(Math.max(hover.x + 12, 8), Math.max(wrapWidth - TOOLTIP_WIDTH - 8, 8))
    : 0

  return (
    <div className="journal-chart-wrap">
      <div className="journal-chart-toolbar">
        <span className="journal-chart-toolbar-label">均線</span>
        {MA_DEFS.map((def) => (
          <button
            key={def.key}
            type="button"
            className={`journal-ma-btn${activeMA.includes(def.key) ? ' is-on' : ''}`}
            style={{ '--ma-color': def.color }}
            onClick={() => toggleMA(def.key)}
          >
            <span className="journal-ma-dot" />
            {def.label}
          </button>
        ))}
      </div>

      <div
        className="journal-chart"
        ref={wrapRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
        >
        <div className="journal-chart-canvas" ref={chartElRef} />
        <canvas ref={ribbonRef} className="journal-chart-ribbon" aria-hidden="true" />

        {rows.length === 0 && (
          <div className="journal-chart-empty">目前沒有大盤資料</div>
        )}

        {hover && (
          <div
            className="journal-chart-tip"
            style={{ left: tipLeft, bottom: BAND_HEIGHT + 18 }}
          >
            <div className="journal-chart-tip-date">{fmtDate(hover.row.date)}</div>
            <div className="journal-chart-tip-ohlc">
              開 {hover.row.open} / 高 {hover.row.high} / 低 {hover.row.low} / 收 {hover.row.close}
            </div>
            {hover.entry ? (
              <>
                <div className="journal-chart-tip-view">
                  <span className={`journal-view-dot is-${hover.entry.view}`} />
                  {VIEW_LABEL[hover.entry.view]}．{hover.entry.summary}
                </div>
                <div className="journal-chart-tip-next">
                  隔日 {fmtPct(nextRef.current?.get(hover.row.date))}
                </div>
              </>
            ) : (
              <div className="journal-chart-tip-view journal-chart-tip-muted">這天沒有日誌</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MarketChart
