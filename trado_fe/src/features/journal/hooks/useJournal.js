import { useCallback, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import to from 'await-to-js'
import dayjs from 'dayjs'
import { journalService } from '../services/journal'
import { getStockKlineApi } from '@/api/api_stock'

/** 內文空白時按 Tab 插入的三段骨架（固定文案，前端不用客製） */
export const JOURNAL_TEMPLATE = `【盤面】量能、誰在撐盤、誰在殺、關鍵價位

【理由】為什麼這樣看（1～3 點就好）

【明日觀察】什麼價位或事件會驗證／推翻我`

/** 現在的台北日期（YYYY-MM-DD）；日誌一律以台北時區的交易日為準 */
export const taipeiTodayIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

const CHART_MONTHS = 6

export const useJournal = () => {
  const todayIso = useMemo(() => taipeiTodayIso(), [])
  const range = useMemo(
    () => ({
      from: dayjs(todayIso).subtract(CHART_MONTHS, 'month').format('YYYY-MM-DD'),
      to: todayIso,
    }),
    [todayIso],
  )

  const [activeDate, setActiveDate] = useState(todayIso)
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [entries, setEntries] = useState([])
  const [kline, setKline] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** 今天到底是不是交易日（圖表可能還沒補上今天的 K 棒，用 context 補判斷） */
  const [todayIsTradingDay, setTodayIsTradingDay] = useState(null)

  const loadContext = useCallback(async (date) => {
    setContextLoading(true)
    const [err, res] = await to(journalService.getContext(date))
    if (err) {
      message.error(err.msg || err.message || '載入盤面資料失敗')
      setContext(null)
    } else {
      setContext(res)
      if (date === todayIso) setTodayIsTradingDay(!!res?.isTradingDay)
    }
    setContextLoading(false)
  }, [todayIso])

  const loadEntries = useCallback(async () => {
    const [err, res] = await to(journalService.list(range))
    if (err) {
      message.error(err.msg || err.message || '載入盤後日誌失敗')
      setEntries([])
      return
    }
    setEntries(Array.isArray(res) ? res : [])
  }, [range])

  const loadKline = useCallback(async () => {
    const [err, res] = await to(getStockKlineApi('TAIEX', range.from, range.to))
    if (err) {
      message.error(err.msg || err.message || '載入大盤 K 線失敗')
      setKline([])
      return
    }
    setKline(res?.rows || [])
  }, [range])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadEntries(), loadKline()])
    setLoading(false)
  }, [loadEntries, loadKline])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    loadContext(activeDate)
  }, [activeDate, loadContext])

  const entriesByDate = useMemo(
    () => new Map(entries.map((e) => [e.tradeDate, e])),
    [entries],
  )

  // 隔日漲跌由 K 線自行算：列表的區間與圖表相同，最後一個交易日只是還沒「隔日」而已
  const nextChangePctByDate = useMemo(() => {
    const map = new Map()
    for (let i = 0; i < kline.length - 1; i += 1) {
      const close = kline[i].close
      const next = kline[i + 1].close
      if (close) map.set(kline[i].date, (next - close) / close)
    }
    return map
  }, [kline])

  const tradingDays = useMemo(() => kline.map((r) => r.date), [kline])

  const saveEntry = useCallback(
    async (payload) => {
      setSaving(true)
      const [err] = await to(journalService.save(activeDate, payload))
      setSaving(false)
      if (err) {
        message.error(err.msg || err.message || '儲存失敗')
        return false
      }
      message.success(activeDate === todayIso ? '今天的盤後已記下' : '已更新日誌')
      await Promise.all([loadContext(activeDate), loadEntries()])
      return true
    },
    [activeDate, todayIso, loadContext, loadEntries],
  )

  const deleteEntry = useCallback(
    async (date) => {
      const [err] = await to(journalService.remove(date))
      if (err) {
        message.error(err.msg || err.message || '刪除失敗')
        return false
      }
      message.success('已刪除')
      if (date === activeDate) await loadContext(date)
      await loadEntries()
      return true
    },
    [activeDate, loadContext, loadEntries],
  )

  return {
    todayIso,
    range,
    activeDate,
    setActiveDate,
    context,
    contextLoading,
    entries,
    entriesByDate,
    kline,
    tradingDays,
    nextChangePctByDate,
    todayIsTradingDay,
    loading,
    saving,
    saveEntry,
    deleteEntry,
    refetch: loadAll,
  }
}
