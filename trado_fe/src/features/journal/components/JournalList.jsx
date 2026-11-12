import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button, Empty, Popconfirm, Segmented, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'bull', label: '多' },
  { value: 'neutral', label: '中性' },
  { value: 'bear', label: '空' },
  { value: 'unwritten', label: '未寫' },
]

const VIEW_LABEL = { bull: '多', neutral: '中性', bear: '空' }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const fmtDay = (iso) => {
  const [, m, d] = iso.split('-')
  const wd = WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]
  return `${m}/${d}（${wd}）`
}

const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)

const JournalList = forwardRef(function JournalList(
  {
    tradingDays,
    entriesByDate,
    nextChangePctByDate,
    todayIso,
    todayIsTradingDay,
    activeDate,
    onEdit,
    onDelete,
    onWriteToday,
  },
  ref,
) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [pendingScroll, setPendingScroll] = useState(null)
  const rowRefs = useRef({})

  const rows = useMemo(() => {
    const days = [...tradingDays]
    if (todayIsTradingDay && !days.includes(todayIso)) days.push(todayIso)
    return days
      .map((date) => ({ date, entry: entriesByDate.get(date) || null }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [tradingDays, entriesByDate, todayIso, todayIsTradingDay])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'unwritten') return rows.filter((r) => !r.entry)
    return rows.filter((r) => r.entry?.view === filter)
  }, [rows, filter])

  const hasAnyEntry = rows.some((r) => r.entry)

  // 點多空帶 → 切回「全部」、展開該列、捲到中間
  useImperativeHandle(ref, () => ({
    focusDate: (date) => {
      setFilter('all')
      setExpanded(date)
      setPendingScroll(date)
    },
  }), [])

  useEffect(() => {
    if (!pendingScroll) return
    const el = rowRefs.current[pendingScroll]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingScroll(null)
    }
  }, [pendingScroll, filtered])

  const toggle = (row) => {
    if (!row.entry) {
      onEdit(row.date)
      return
    }
    setExpanded((prev) => (prev === row.date ? null : row.date))
  }

  return (
    <div className="journal-list">
      <div className="journal-list-head">
        <span className="text-subtitle">歷史日誌</span>
        <Segmented
          size="small"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {!hasAnyEntry && filter === 'all' ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="還沒有任何盤後日誌"
          className="journal-list-empty"
        >
          <Button type="primary" onClick={onWriteToday}>
            寫第一篇
          </Button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="這個篩選沒有符合的交易日" />
      ) : (
        <div className="journal-list-scroll thin-scrollbar">
          {filtered.map((row) => {
            const { entry, date } = row
            const nextPct = nextChangePctByDate.get(date)
            const isOpen = expanded === date
            return (
              <div
                key={date}
                ref={(el) => {
                  rowRefs.current[date] = el
                }}
                className={[
                  'journal-row',
                  isOpen ? 'is-open' : '',
                  date === todayIso ? 'is-today' : '',
                  date === activeDate ? 'is-active' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => toggle(row)}
              >
                <div className="journal-row-date">
                  {fmtDay(date)}
                  {date === todayIso && <span className="journal-row-today">今天</span>}
                </div>

                <div className="journal-row-main">
                  <div className="journal-row-line">
                    {entry ? (
                      <>
                        <span className={`journal-view-dot is-${entry.view}`} />
                        <span className={`journal-row-view is-${entry.view}`}>
                          {VIEW_LABEL[entry.view]}
                        </span>
                        <span className="journal-row-summary">{entry.summary}</span>
                        {entry.backfilled && <span className="journal-row-backfill">補寫</span>}
                      </>
                    ) : (
                      <span className="journal-row-summary journal-row-muted">
                        {date === todayIso ? '30 秒寫一下今天的盤後' : '尚未紀錄'}
                      </span>
                    )}
                  </div>
                  {isOpen && entry && (
                    <div className="journal-row-body">
                      {entry.body || <span className="journal-row-muted">（沒有內文）</span>}
                    </div>
                  )}
                </div>

                <div className="journal-row-next">
                  <span className="journal-row-next-label">隔日</span>
                  <span
                    className={
                      nextPct == null
                        ? 'journal-row-muted'
                        : nextPct > 0
                          ? 'is-up'
                          : nextPct < 0
                            ? 'is-down'
                            : ''
                    }
                  >
                    {fmtPct(nextPct)}
                  </span>
                </div>

                <div className="journal-row-actions" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={entry ? '編輯' : '補寫'}>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => onEdit(date)}
                    />
                  </Tooltip>
                  {entry && (
                    <Popconfirm
                      title="刪除這篇日誌？"
                      description="刪除後多空帶上這一格會恢復空白。"
                      okText="刪除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onDelete(date)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="刪除"
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default JournalList
