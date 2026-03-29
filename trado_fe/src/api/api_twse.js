/**
 * 台灣證券交易所開放資料 API
 * 參考：https://openapi.twse.com.tw/
 * 
 * 注意：TWSE API 可能有 CORS 限制，可能需要透過後端代理
 */

/**
 * 獲取個股每日收盤行情（K線資料）
 * @param {string} stockNo - 股票代號，如 "2330"
 * @param {string} date - 日期格式：YYYYMMDD，如 "20240101"
 * @returns {Promise<Object>} TWSE API 回應資料
 * 
 * API 端點：https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY
 * 參數：
 *   - response: json
 *   - date: YYYYMMDD
 *   - stockNo: 股票代號
 */
export const getStockKLineApi = async (stockNo, date) => {
  if (!stockNo) {
    throw new Error('股票代號不能為空')
  }

  // 如果沒有提供日期，使用今天
  let dateStr = date
  if (!dateStr) {
    const today = new Date()
    dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  } else if (dateStr.includes('-')) {
    // 如果日期格式是 YYYY-MM-DD，轉換為 YYYYMMDD
    dateStr = dateStr.replace(/-/g, '')
  }

  const url = `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${stockNo}`

  try {
    // 直接 fetch（如果 CORS 允許）
    // 如果遇到 CORS 問題，需要透過後端代理
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`TWSE API 錯誤: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('TWSE API 錯誤:', error)
    // 如果是 CORS 錯誤，建議透過後端代理
    if (error.message.includes('CORS') || error.message.includes('fetch')) {
      throw new Error('TWSE API 需要透過後端代理，請聯繫後端開發者設定代理端點')
    }
    throw error
  }
}

/**
 * 獲取多日歷史資料
 * 注意：TWSE API 單次只能取得單日資料，需要多次調用
 * @param {string} stockNo - 股票代號
 * @param {string} startDate - 開始日期 YYYYMMDD
 * @param {string} endDate - 結束日期 YYYYMMDD
 * @returns {Promise<Array>} 合併後的歷史資料陣列
 */
export const getStockHistoryApi = async (stockNo, startDate, endDate) => {
  // 實作邏輯：循環調用 getStockKLineApi
  // 注意：這可能會觸發 API 頻率限制，建議透過後端批量處理
  const results = []
  
  // 簡單實作：只獲取最近 30 天的資料
  const dates = []
  const start = new Date(startDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
  const end = new Date(endDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
  
  let current = new Date(start)
  while (current <= end) {
    const dateStr = `${current.getFullYear()}${String(current.getMonth() + 1).padStart(2, '0')}${String(current.getDate()).padStart(2, '0')}`
    dates.push(dateStr)
    current.setDate(current.getDate() + 1)
  }

  // 限制最多 30 天，避免過多請求
  const limitedDates = dates.slice(-30)
  
  for (const date of limitedDates) {
    try {
      const data = await getStockKLineApi(stockNo, date)
      if (data && data.data) {
        results.push(...data.data)
      }
      // 添加延遲避免觸發頻率限制
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.warn(`獲取 ${date} 資料失敗:`, error)
    }
  }

  return results
}
