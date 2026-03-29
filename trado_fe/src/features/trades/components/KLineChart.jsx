import React, { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { Spin, message } from 'antd'
import { getStockKLineApi, getStockHistoryApi } from '@/api/api_twse'
import dayjs from 'dayjs'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 轉換 TWSE API 資料為 TradingView 格式
  const convertToKLineData = (twseData) => {
    if (!twseData || !Array.isArray(twseData.data)) return []
    
    return twseData.data.map(item => {
      // TWSE API 格式：日期可能是 "113/01/15" (民國年) 或 "2024/01/15"
      const dateStr = item.Date || item.date || item.日期
      let date = ''
      
      if (dateStr) {
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            const [year, month, day] = parts
            // 判斷是民國年還是西元年（民國年通常 < 200）
            if (parseInt(year) < 200) {
              // 民國年轉西元年
              date = `${1911 + parseInt(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            } else {
              date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            }
          }
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // 已經是 YYYY-MM-DD 格式
          date = dateStr
        }
      }
      
      // 處理價格欄位（TWSE API 可能使用中文或英文欄位名）
      const open = parseFloat(item.OpenPrice || item.開盤價 || item.open || 0)
      const high = parseFloat(item.HighestPrice || item.最高價 || item.high || 0)
      const low = parseFloat(item.LowestPrice || item.最低價 || item.low || 0)
      const close = parseFloat(item.ClosingPrice || item.收盤價 || item.close || 0)
      const volume = parseFloat(item.TradeVolume || item.成交股數 || item.volume || 0)

      if (!date || (open === 0 && high === 0 && low === 0 && close === 0)) {
        return null
      }

      return {
        time: date, // TradingView 需要 YYYY-MM-DD 格式
        open,
        high,
        low,
        close,
        volume,
      }
    }).filter(item => item !== null) // 過濾無效資料
  }

  // 轉換 positions 為 markers
  const convertToMarkers = (positions) => {
    if (!positions || !Array.isArray(positions) || positions.length === 0) return []
    
    return positions
      .filter(position => position.date || position.timestamp) // 過濾沒有日期的 position
      .map(position => {
        // position.date 格式應該是 YYYY-MM-DD
        let date = position.date || position.timestamp
        
        // 如果是 dayjs 物件，轉換為字串
        if (dayjs.isDayjs(date)) {
          date = date.format('YYYY-MM-DD')
        } else if (typeof date === 'string' && date.includes('T')) {
          // 如果是 ISO 格式，只取日期部分
          date = date.split('T')[0]
        }
        
        const action = position.action || 'buy'
        const price = parseFloat(position.price) || 0
        const shares = parseInt(position.shares) || 0

        return {
          time: date,
          position: action === 'buy' ? 'belowBar' : 'aboveBar',
          color: action === 'buy' ? '#26a69a' : '#ef5350',
          shape: action === 'buy' ? 'arrowUp' : 'arrowDown',
          text: `${action === 'buy' ? '買' : '賣'} ${shares}股 @ $${price}`,
          size: 1,
        }
      })
      .filter(marker => marker.time) // 過濾無效的日期
  }

  // 載入 K 線資料
  useEffect(() => {
    if (!symbol || !chartContainerRef.current || !candlestickSeriesRef.current) return

    const loadKLineData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // 計算需要獲取的日期範圍（從最早的 position 到現在）
        let startDate = null
        let endDate = new Date()
        
        if (positions && positions.length > 0) {
          const dates = positions
            .map(p => {
              let date = p.date || p.timestamp
              if (dayjs.isDayjs(date)) {
                return date.toDate()
              } else if (typeof date === 'string') {
                return new Date(date.split('T')[0])
              }
              return null
            })
            .filter(d => d && !isNaN(d.getTime()))
          
          if (dates.length > 0) {
            startDate = new Date(Math.min(...dates))
            // 往前推 30 天以顯示更多 K 線
            startDate.setDate(startDate.getDate() - 30)
          }
        }

        let klineData = []

        if (startDate) {
          // 獲取歷史資料
          const startStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`
          const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`
          
          try {
            const historyData = await getStockHistoryApi(symbol, startStr, endStr)
            if (historyData && historyData.length > 0) {
              // 轉換歷史資料
              const converted = historyData.map(item => {
                const dateStr = item.Date || item.date || item.日期
                let date = ''
                
                if (dateStr && dateStr.includes('/')) {
                  const parts = dateStr.split('/')
                  if (parts.length === 3) {
                    const [year, month, day] = parts
                    if (parseInt(year) < 200) {
                      date = `${1911 + parseInt(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                    } else {
                      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                    }
                  }
                }
                
                const open = parseFloat(item.OpenPrice || item.開盤價 || item.open || 0)
                const high = parseFloat(item.HighestPrice || item.最高價 || item.high || 0)
                const low = parseFloat(item.LowestPrice || item.最低價 || item.low || 0)
                const close = parseFloat(item.ClosingPrice || item.收盤價 || item.close || 0)
                const volume = parseFloat(item.TradeVolume || item.成交股數 || item.volume || 0)

                if (!date || (open === 0 && high === 0 && low === 0 && close === 0)) {
                  return null
                }

                return { time: date, open, high, low, close, volume }
              }).filter(item => item !== null)
              
              klineData = converted
            }
          } catch (err) {
            console.warn('獲取歷史資料失敗，嘗試獲取單日資料:', err)
          }
        }

        // 如果歷史資料獲取失敗，嘗試獲取今日資料
        if (klineData.length === 0) {
          const today = new Date()
          const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
          const twseData = await getStockKLineApi(symbol, todayStr)
          klineData = convertToKLineData(twseData)
        }
        
        if (klineData.length > 0) {
          // 按日期排序
          klineData.sort((a, b) => a.time.localeCompare(b.time))
          
          candlestickSeriesRef.current.setData(klineData)
          
          // 添加買賣標記
          const markers = convertToMarkers(positions)
          if (markers.length > 0) {
            candlestickSeriesRef.current.setMarkers(markers)
          }
        } else {
          setError('無法獲取 K 線資料，請確認股票代號是否正確')
        }
      } catch (err) {
        console.error('載入 K 線資料失敗:', err)
        setError(err.message || '載入 K 線資料失敗')
        message.error('載入 K 線圖失敗，可能是 CORS 限制或 API 錯誤')
      } finally {
        setLoading(false)
      }
    }

    loadKLineData()
  }, [symbol, positions])

  // 初始化圖表
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

    candlestickSeriesRef.current = candlestickSeries
    chartRef.current = chart

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
  }, [])

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

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
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
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
            提示：TWSE API 可能需要透過後端代理
          </div>
        </div>
      )}
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default KLineChart
