import React from 'react'
import { Button, Card } from 'antd'

const VIEW_META = {
  bull: { label: '多', cls: 'is-bull' },
  neutral: { label: '中性', cls: 'is-neutral' },
  bear: { label: '空', cls: 'is-bear' },
}

const fmtDate = (iso) => iso.replaceAll('-', '/')
const fmtPct = (v) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

/**
 * 右欄唯讀卡：顯示「目前選取的交易日」寫了什麼
 * 跟左欄的表單分工：左邊負責寫、右邊負責回頭看；點圖表或列表任一天就換這張卡的內容
 */
const JournalDayCard = ({ date, entry, isToday, isTradingDay, onEdit }) => {
  const view = entry ? VIEW_META[entry.view] : null
  const nextCls =
    entry?.nextChangePct > 0 ? 'is-up' : entry?.nextChangePct < 0 ? 'is-down' : ''

  return (
    <Card className="journal-card journal-day-card">
      <div className="journal-day">
        <div className="journal-day-head">
          <span className="journal-day-date">
            {fmtDate(date)}
            {isToday && <span className="journal-row-today">今天</span>}
            {entry?.backfilled && <span className="journal-row-backfill">補寫</span>}
          </span>
          {view ? (
            <span className={`journal-day-view ${view.cls}`}>
              <span className={`journal-view-dot ${view.cls}`} />
              {view.label}
            </span>
          ) : (
            <span className="journal-day-view is-muted">未寫</span>
          )}
        </div>

        {entry ? (
          <>
            <div className="journal-day-summary">{entry.summary}</div>

            <div className="journal-day-next">
              隔日驗證：
              {entry.nextDate ? (
                <span className={nextCls}>
                  {fmtDate(entry.nextDate)} {fmtPct(entry.nextChangePct)}
                </span>
              ) : (
                <span className="journal-day-muted">尚無隔日資料</span>
              )}
            </div>

            {entry.body ? (
              <div className="journal-day-body">{entry.body}</div>
            ) : (
              <div className="journal-day-muted">這天只寫了一句話</div>
            )}
          </>
        ) : (
          <div className="journal-day-empty">
            <span>
              {isTradingDay === false ? '這天休市' : '這天還沒寫日誌'}
            </span>
            {isTradingDay !== false && (
              <Button size="small" onClick={() => onEdit(date)}>
                寫這天
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default JournalDayCard
