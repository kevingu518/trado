import React, { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Segmented, Skeleton, Tag, Tooltip } from 'antd'
import { JOURNAL_TEMPLATE } from '../hooks/useJournal'

const VIEW_OPTIONS = [
  { value: 'bull', label: '多' },
  { value: 'neutral', label: '中性' },
  { value: 'bear', label: '空' },
]

const VIEW_LABEL = { bull: '多', neutral: '中性', bear: '空' }

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const fmtDateTitle = (iso) => {
  const [y, m, d] = iso.split('-')
  const wd = WEEKDAY[new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay()]
  return `${y}/${m}/${d}（${wd}）`
}

const draftKeyOf = (date) => `trado.journal.draft.${date}`

const readDraft = (date) => {
  try {
    return JSON.parse(localStorage.getItem(draftKeyOf(date)) || 'null')
  } catch {
    return null
  }
}

const JournalForm = ({ date, todayIso, context, loading, saving, onSave, onBackToToday }) => {
  const [view, setView] = useState(null)
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState({})
  const [dirty, setDirty] = useState(false)
  const bodyRef = useRef(null)

  const entry = context?.entry
  const isToday = date === todayIso
  const draftKey = draftKeyOf(date)

  // 換日期或存檔後（entry.updatedAt 變了）→ 以草稿優先，其次資料庫內容
  useEffect(() => {
    const draft = readDraft(date)
    const src = draft || (entry
      ? { view: entry.view, summary: entry.summary, body: entry.body || '' }
      : { view: null, summary: '', body: '' })
    setView(src.view || null)
    setSummary(src.summary || '')
    setBody(src.body || '')
    setErrors({})
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, entry?.id, entry?.updatedAt])

  // 使用者真的改了才寫草稿；存檔成功會清掉
  useEffect(() => {
    if (!dirty) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ view, summary, body }))
    } catch {
      // 私密模式 / 空間滿了：草稿存不進去不影響存檔
    }
  }, [dirty, draftKey, view, summary, body])

  const validate = () => {
    const next = {}
    if (!view) next.view = '請選擇多空方向'
    if (!summary.trim()) next.summary = '一句話是必填的'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (saving) return
    if (!validate()) return
    const ok = await onSave({ view, summary: summary.trim(), body })
    if (ok) {
      try {
        localStorage.removeItem(draftKey)
      } catch {
        // noop
      }
      setDirty(false)
    }
  }

  const setCursor = (pos) => {
    requestAnimationFrame(() => {
      const el = bodyRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const insertTemplate = () => {
    setBody(JOURNAL_TEMPLATE)
    setDirty(true)
    const pos = JOURNAL_TEMPLATE.indexOf('】') + 1
    setCursor(pos)
  }

  const insertAtCursor = (text) => {
    const el = bodyRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`
    setBody(next)
    setDirty(true)
    setCursor(start + text.length)
  }

  const handleBodyKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // 內文空白 → 插入三段骨架；已經有內容 → 一般縮排
      if (!body.trim()) insertTemplate()
      else insertAtCursor('  ')
      return
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  if (loading && !context) {
    return <Skeleton active paragraph={{ rows: 4 }} />
  }

  if (!context) {
    return <Alert type="warning" showIcon message="盤面資料暫時取得不到，稍後再試" />
  }

  return (
    <div className="journal-form">
      <div className="journal-form-head">
        <div className="journal-form-title">
          <span className="text-subtitle">盤後日誌</span>
          <span className="journal-form-date">{fmtDateTitle(date)}</span>
          {isToday && <Tag color="blue">今天</Tag>}
          {entry?.backfilled && (
            <Tooltip title="建立時間晚於次一交易日 09:00，屬於事後補寫">
              <Tag>補寫</Tag>
            </Tooltip>
          )}
        </div>
        {!isToday && (
          <Button type="link" size="small" onClick={onBackToToday}>
            回到今天
          </Button>
        )}
      </div>

      {!context?.isTradingDay ? (
        <Alert
          type="info"
          showIcon
          message={isToday ? '今天休市，沒有盤後日誌' : '這天休市，沒有盤後日誌'}
          description="盤後日誌只在台股有交易的日子開放。"
        />
      ) : (
        <>
          {context?.prevEntry && (
            <div className="journal-prev">
              上一篇（{context.prevEntry.tradeDate}）：
              <b>{VIEW_LABEL[context.prevEntry.view] || context.prevEntry.view}</b>
              ．{context.prevEntry.summary}
            </div>
          )}

          <div className="journal-field">
            <Segmented
              block
              value={view || undefined}
              onChange={(v) => {
                setView(v)
                setDirty(true)
                setErrors((p) => ({ ...p, view: undefined }))
              }}
              options={VIEW_OPTIONS.map((o) => ({
                value: o.value,
                label: <span className={`journal-view-label is-${o.value}`}>{o.label}</span>,
              }))}
            />
            {errors.view && <div className="journal-field-error">{errors.view}</div>}
          </div>

          <div className="journal-field">
            <Input
              value={summary}
              maxLength={40}
              showCount
              placeholder="一句話：今天盤面怎麼看？（例：量縮守月線，明天偏多看能否補量）"
              onChange={(e) => {
                setSummary(e.target.value)
                setDirty(true)
                setErrors((p) => ({ ...p, summary: undefined }))
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              status={errors.summary ? 'error' : undefined}
            />
            {errors.summary && <div className="journal-field-error">{errors.summary}</div>}
          </div>

          <div className="journal-field">
            <div className="journal-body-head">
              <span className="journal-body-hint">
                Tab 插入範本／縮排 · Esc 離開 · Cmd/Ctrl+Enter 儲存
              </span>
              <Button
                size="small"
                type="dashed"
                className="journal-template-btn"
                onClick={() => insertAtCursor(JOURNAL_TEMPLATE)}
              >
                插入範本
              </Button>
            </div>
            <textarea
              ref={bodyRef}
              className="journal-body-input"
              value={body}
              rows={8}
              placeholder="選填。按 Tab 會帶入【盤面】【理由】【明日觀察】三段骨架。"
              onChange={(e) => {
                setBody(e.target.value)
                setDirty(true)
              }}
              onKeyDown={handleBodyKeyDown}
            />
          </div>

          <div className="journal-form-actions">
            <span className="journal-form-saved">
              {entry ? `上次儲存 ${new Date(entry.updatedAt).toLocaleString('zh-TW')}` : '尚未紀錄'}
            </span>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {entry ? '更新日誌' : '儲存日誌'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default JournalForm
