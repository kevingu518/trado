import React, { useEffect, useRef, useState } from 'react'
import { createChart, LineStyle } from 'lightweight-charts'
import { Spin } from 'antd'
import { getStockKlineApi } from '@/api/api_stock'
import dayjs from 'dayjs'

// 均線設定：顏色挑跟綠/紅 K 棒、進出場橫線可區分的（避開 #26a69a / #ef5350）
const MA_CONFIG = [
  { period: 5, color: '#F59E0B' },   // amber
  { period: 10, color: '#3B82F6' },  // blue
  { period: 20, color: '#8B5CF6' },  // violet
  { period: 45, color: '#EC4899' },  // pink
  { period: 60, color: '#06B6D4' },  // cyan
]

// 拖拉懶載入：拖到資料左端 < 10 根 K 棒就觸發；每次往前抓 6 個月，最多回溯 5 年
const LAZY_LOAD_THRESHOLD_BARS = 10
const LOAD_OLDER_CHUNK_MONTHS = 6
const MAX_HISTORY_YEARS = 5

/**
 * K 線圖組件
 * 使用 TradingView Lightweight Charts
 * 
 * @param {string} symbol - 股票代號，如 "2330"
 * @param {Array} positions - Position 數據 [{ date, action, price, shares, ... }]
 * @param {number} height - 圖表高度
 */
const KLineChart = ({ 
  symbol,           // 股票代號
  positions = [],   // Position 數據
  height = 400
}) => {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candlestickSeriesRef = useRef(null)
  const maSeriesRef = useRef({}) // { [period]: ISeriesApi }
  const priceLinesRef = useRef([])
  // 完整 klineData（給 loadOlder 用來 merge / 重算 MA）
  const klineDataRef = useRef([])
  // loadOlder 狀態鎖
  const isLoadingOlderRef = useRef(false)
  const reachedStartRef = useRef(false)
  // 觸發 loadOlder 的 handler，在 data-loading effect 中設定（透過 ref 讓 chart-init subscribe 可呼叫到最新版）
  const loadOlderRef = useRef(() => {})
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState(null)
  const [maValues, setMaValues] = useState({}) // { [period]: number }
  // 預設 5/10/20 開啟，45/60 預設關閉，使用者可從 legend 切換
  const [enabledMAs, setEnabledMAs] = useState({ 5: true, 10: true, 20: true, 45: false, 60: false })

  // SMA(period)：對 close 做 N 日簡單移動平均
  const computeMA = (klineData, period) => {
    if (!klineData || klineData.length < period) return []
    const result = []
    let sum = 0
    for (let i = 0; i < klineData.length; i++) {
      sum += klineData[i].close
      if (i >= period) sum -= klineData[i - period].close
      if (i >= period - 1) {
        result.push({ time: klineData[i].time, value: sum / period })
      }
    }
    return result
  }

  // 計算 avg 買/賣價（加權平均）
  const computeAvgPrices = (positions) => {
    const acc = { buyShares: 0, buyCost: 0, sellShares: 0, sellRevenue: 0 }
    for (const p of positions || []) {
      const price = parseFloat(p.price) || 0
      const shares = parseInt(p.shares) || 0
      if (!price || !shares) continue
      if (p.action === 'buy') {
        acc.buyShares += shares
        acc.buyCost += price * shares
      } else if (p.action === 'sell') {
        acc.sellShares += shares
        acc.sellRevenue += price * shares
      }
    }
    return {
      avgBuy: acc.buyShares > 0 ? acc.buyCost / acc.buyShares : null,
      avgSell: acc.sellShares > 0 ? acc.sellRevenue / acc.sellShares : null,
    }
  }

  // YYYY-MM-DD 工具：給 loadOlder 算錨點用
  const toIsoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const addMonths = (isoDate, months) => {
    const d = new Date(`${isoDate}T00:00:00`)
    d.setMonth(d.getMonth() + months)
    return toIsoDate(d)
  }
  const addDays = (isoDate, days) => {
    const d = new Date(`${isoDate}T00:00:00`)
    d.setDate(d.getDate() + days)
    return toIsoDate(d)
  }

  // 把各種 position.date 格式 normalize 成 lightweight-charts 要的 YYYY-MM-DD
  const normalizeDate = (raw) => {
    if (!raw) return null
    if (dayjs.isDayjs(raw)) return raw.format('YYYY-MM-DD')
    let s = String(raw)
    if (s.includes('T')) s = s.split('T')[0]  // ISO 取日期段
    s = s.replace(/\//g, '-')                 // 斜線 → dash
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }

  // 轉換 positions 為 markers
  const convertToMarkers = (positions) => {
    if (!positions || !Array.isArray(positions) || positions.length === 0) return []

    return positions
      .map((position) => {
        const date = normalizeDate(position.date || position.timestamp)
        if (!date) return null

        const action = position.action || 'buy'

        return {
          time: date,
          position: action === 'buy' ? 'belowBar' : 'aboveBar',
          color: action === 'buy' ? '#26a69a' : '#ef5350',
          shape: action === 'buy' ? 'arrowUp' : 'arrowDown',
          text: action === 'buy' ? 'B' : 'S',
          size: 1,
        }
      })
      .filter(Boolean)
  }

  // 初始化圖表（**必須宣告在 data-loading effect 之前**：effects 依宣告順序執行，
  // 所以 chart-init 要先跑，把 candlestickSeriesRef 設好，data-loading 才能讀得到 ref）
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // 添加 K 線系列
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    // 均線（依 MA_CONFIG 動態建立；visibility 由獨立 effect 依 enabledMAs 同步）
    const seriesMap = {}
    for (const { period, color } of MA_CONFIG) {
      seriesMap[period] = chart.addLineSeries({
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
    }

    candlestickSeriesRef.current = candlestickSeries
    maSeriesRef.current = seriesMap
    chartRef.current = chart

    // 拖拉到資料左端 → 觸發 loadOlder（透過 ref 拿到目前 symbol 的最新 handler）
    const onRangeChange = (range) => {
      if (!range) return
      if (range.from < LAZY_LOAD_THRESHOLD_BARS) {
        loadOlderRef.current?.()
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)

    // 響應式調整
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 把 API row 轉成 lightweight-charts series 格式
  const toBars = (rows) =>
    (rows || []).map((r) => ({
      time: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))

  // 套用 K 線資料（recompute 全部 MA，更新 legend）
  const applyChartData = (bars) => {
    candlestickSeriesRef.current.setData(bars)
    const nextValues = {}
    for (const { period } of MA_CONFIG) {
      const data = computeMA(bars, period)
      maSeriesRef.current[period]?.setData(data)
      nextValues[period] = data.at(-1)?.value ?? null
    }
    setMaValues(nextValues)
  }

  // 載入 K 線資料（初次 / symbol 變更）
  useEffect(() => {
    if (!symbol || !chartContainerRef.current || !candlestickSeriesRef.current) {
      return
    }

    // cleanup 設 true，讓還在 fetch 的 loadOlder/初次載入 不要套用到新 symbol 的圖表
    let cancelled = false

    // 切 symbol 時 reset lazy-load 狀態
    klineDataRef.current = []
    isLoadingOlderRef.current = false
    reachedStartRef.current = false

    const loadKLineData = async () => {
      setLoading(true)
      setError(null)

      try {
        const today = new Date()
        let startDate = new Date(today)
        startDate.setMonth(startDate.getMonth() - 3)

        if (positions && positions.length > 0) {
          const dates = positions
            .map((p) => {
              const d = p.date || p.timestamp
              if (dayjs.isDayjs(d)) return d.toDate()
              if (typeof d === 'string') return new Date(d.split('T')[0])
              return null
            })
            .filter((d) => d && !isNaN(d.getTime()))

          if (dates.length > 0) {
            const earliest = new Date(Math.min(...dates))
            earliest.setDate(earliest.getDate() - 90)
            startDate = earliest
          }
        }

        const startStr = toIsoDate(startDate)
        const endStr = toIsoDate(today)

        const result = await getStockKlineApi(symbol, startStr, endStr)
        if (cancelled) return
        const klineData = toBars(result.rows)

        if (klineData.length === 0) {
          setError(`無法取得 ${symbol} 的 K 線資料（可能是無效股號或外部資料源暫時無回應）`)
          return
        }

        klineDataRef.current = klineData
        applyChartData(klineData)

        // markers / priceLines 跟 positions 綁定，不會被 loadOlder 影響
        const markers = convertToMarkers(positions)
        if (markers.length > 0) {
          candlestickSeriesRef.current.setMarkers(markers)
        }

        priceLinesRef.current.forEach((line) => {
          try { candlestickSeriesRef.current.removePriceLine(line) } catch { /* noop */ }
        })
        priceLinesRef.current = []

        const { avgBuy, avgSell } = computeAvgPrices(positions)
        if (avgBuy != null) {
          priceLinesRef.current.push(candlestickSeriesRef.current.createPriceLine({
            price: Number(avgBuy.toFixed(2)),
            color: '#26a69a',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `進場 $${avgBuy.toFixed(2)}`,
          }))
        }
        if (avgSell != null) {
          priceLinesRef.current.push(candlestickSeriesRef.current.createPriceLine({
            price: Number(avgSell.toFixed(2)),
            color: '#ef5350',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `出場 $${avgSell.toFixed(2)}`,
          }))
        }
      } catch (err) {
        console.error('[KLineChart] load failed:', err)
        setError(err.message || '載入 K 線資料失敗')
      } finally {
        setLoading(false)
      }
    }

    // 拖拉觸發：往前抓一段，merge 到既有資料；保留使用者目前視窗位置（用 logical range offset）
    loadOlderRef.current = async () => {
      if (isLoadingOlderRef.current || reachedStartRef.current) return
      const existing = klineDataRef.current
      if (!existing.length || !candlestickSeriesRef.current) return

      const earliest = existing[0].time // YYYY-MM-DD
      const minAllowed = toIsoDate(new Date(Date.now() - MAX_HISTORY_YEARS * 365 * 24 * 60 * 60 * 1000))
      const newEnd = addDays(earliest, -1)
      let newStart = addMonths(earliest, -LOAD_OLDER_CHUNK_MONTHS)
      if (newStart < minAllowed) newStart = minAllowed

      // 已抵達 5 年上限或無法再往前
      if (newStart >= earliest || newEnd < minAllowed) {
        reachedStartRef.current = true
        return
      }

      isLoadingOlderRef.current = true
      setLoadingOlder(true)
      try {
        const result = await getStockKlineApi(symbol, newStart, newEnd)
        if (cancelled) return
        const olderBars = toBars(result.rows).filter((b) => b.time < earliest)

        if (olderBars.length === 0) {
          // 抓不到更早的資料 → 已到頭，停止後續觸發
          reachedStartRef.current = true
          return
        }

        // 保留視窗位置：setData 會試圖維持 logical range，我們手動往右 shift 新增的 bar 數
        const ts = chartRef.current?.timeScale()
        const prevRange = ts?.getVisibleLogicalRange?.()
        const merged = [...olderBars, ...existing]
        klineDataRef.current = merged
        applyChartData(merged)
        if (prevRange && ts) {
          ts.setVisibleLogicalRange({
            from: prevRange.from + olderBars.length,
            to: prevRange.to + olderBars.length,
          })
        }

        // 若已碰到 5 年上限，這次抓完就鎖住
        if (newStart <= minAllowed) {
          reachedStartRef.current = true
        }
      } catch (err) {
        console.error('[KLineChart] loadOlder failed:', err)
      } finally {
        isLoadingOlderRef.current = false
        setLoadingOlder(false)
      }
    }

    loadKLineData()

    return () => {
      cancelled = true
      // 把 loadOlder handler 設回 noop，避免 chart-init 的 subscribe 還 hold 著舊 closure
      loadOlderRef.current = () => {}
    }
    // convertToMarkers / computeMA / computeAvgPrices 都是 pure helper，不需進 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, positions])

  // 同步 MA 顯隱：點 legend chip 只更新 enabledMAs，這裡 apply 到 series
  useEffect(() => {
    for (const { period } of MA_CONFIG) {
      maSeriesRef.current[period]?.applyOptions({ visible: !!enabledMAs[period] })
    }
  }, [enabledMAs])

  if (!symbol) {
    return (
      <div style={{ 
        height: `${height}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#999'
      }}>
        請選擇股票代號以顯示 K 線圖
      </div>
    )
  }

  const toggleMA = (period) =>
    setEnabledMAs((prev) => ({ ...prev, [period]: !prev[period] }))

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      {!loading && !error && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 12,
          zIndex: 5,
          display: 'flex',
          gap: 6,
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'none', // 整體不擋滑鼠（讓 chart 接到 hover / crosshair）
        }}>
          {MA_CONFIG.map(({ period, color }) => {
            const enabled = !!enabledMAs[period]
            const value = maValues[period]
            return (
              <span
                key={period}
                onClick={() => toggleMA(period)}
                title={enabled ? `點擊隱藏 MA${period}` : `點擊顯示 MA${period}`}
                style={{
                  pointerEvents: 'auto', // 只有 chip 本身可點
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${enabled ? color : '#d9d9d9'}`,
                  background: enabled ? 'rgba(255,255,255,0.85)' : 'rgba(245,245,245,0.85)',
                  color: enabled ? color : '#bbb',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                MA{period}
                {enabled && value != null && (
                  <span style={{ marginLeft: 4, fontWeight: 400 }}>{value.toFixed(2)}</span>
                )}
              </span>
            )
          })}
        </div>
      )}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10
        }}>
          <Spin size="large" />
        </div>
      )}
      {loadingOlder && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 6,
          fontSize: 12,
          color: '#666',
          background: 'rgba(255,255,255,0.85)',
          padding: '2px 10px',
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          pointerEvents: 'none',
        }}>
          載入更早資料…
        </div>
      )}
      {error && !loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          color: '#ff4d4f',
          textAlign: 'center',
          padding: '16px',
          background: '#fff',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <div>{error}</div>
        </div>
      )}
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default KLineChart
