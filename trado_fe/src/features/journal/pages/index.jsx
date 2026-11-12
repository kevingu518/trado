import React, { useRef } from 'react'
import { Card } from 'antd'
import { useJournal } from '../hooks/useJournal'
import MarketChart from '../components/MarketChart'
import MarketStrip from '../components/MarketStrip'
import JournalForm from '../components/JournalForm'
import JournalList from '../components/JournalList'
import '../styles/index.scss'

const Journal = () => {
  const {
    todayIso,
    activeDate,
    setActiveDate,
    context,
    contextLoading,
    entriesByDate,
    kline,
    tradingDays,
    nextChangePctByDate,
    todayIsTradingDay,
    saving,
    saveEntry,
    deleteEntry,
  } = useJournal()

  const listRef = useRef(null)
  const formRef = useRef(null)

  // 切換日期時 context 還是前一天的；對不上就當作沒資料，避免表單短暫顯示別天的內容
  const contextStale = !!context && context.tradeDate !== activeDate
  const activeContext = contextStale ? null : context
  const contextLoadingOrStale = contextLoading || contextStale

  const handleEdit = (date) => {
    setActiveDate(date)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="Journal">
      <div className="Journal-header">
        <span className="text-title font-bold font-serif">盤後日誌</span>
        <span className="text-hint">每天 30 秒留下多空與理由，回頭看自己的判斷</span>
      </div>

      <Card className="journal-card" styles={{ body: { padding: '10px 12px 6px' } }}>
        <MarketStrip
          date={activeDate}
          isToday={activeDate === todayIso}
          context={activeContext}
          loading={contextLoadingOrStale}
        />
        <MarketChart
          rows={kline}
          entriesByDate={entriesByDate}
          nextChangePctByDate={nextChangePctByDate}
          onSelectDate={(date) => listRef.current?.focusDate(date)}
        />
      </Card>

      <div ref={formRef}>
        <Card className="journal-card">
          <JournalForm
            date={activeDate}
            todayIso={todayIso}
            context={activeContext}
            loading={contextLoadingOrStale}
            saving={saving}
            onSave={saveEntry}
            onBackToToday={() => setActiveDate(todayIso)}
          />
        </Card>
      </div>

      <Card className="journal-card">
        <JournalList
          ref={listRef}
          tradingDays={tradingDays}
          entriesByDate={entriesByDate}
          nextChangePctByDate={nextChangePctByDate}
          todayIso={todayIso}
          todayIsTradingDay={!!todayIsTradingDay}
          activeDate={activeDate}
          onEdit={handleEdit}
          onDelete={deleteEntry}
          onWriteToday={() => handleEdit(todayIso)}
        />
      </Card>
    </div>
  )
}

export default Journal
