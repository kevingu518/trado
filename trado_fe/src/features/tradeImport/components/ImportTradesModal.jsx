// src/features/tradeImport/components/ImportTradesModal.jsx
import React, { useRef } from 'react'
import {
  Modal, Button, Steps, Select, Input, Alert, Tag, Table, Statistic, Spin, Tooltip, message,
} from 'antd'
import {
  InboxOutlined, FileTextOutlined, CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import useTradeImport from '../hooks/useTradeImport'
import '../styles/ImportTradesModal.scss'

/**
 * 交易紀錄匯入精靈（TD-112）
 * 三步：上傳檔案 → 欄位對應 → 預覽確認，最後一步才寫入資料。
 *
 * 檔案直接用原生 <input type="file">：全站沒有其他地方用到上傳，
 * 而且我們要把 File 原檔當 fetch body 送出（不經 multipart），自己管最單純。
 */

// 與後端 services/TradeFileParser.js 的上限一致，讓使用者在選檔當下就知道，
// 不必等上傳完才被擋（後端仍會再檢查一次）。
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const MAX_FILE_BYTES = 10 * 1024 * 1024

const formatNumber = (n) => (n == null ? '—' : new Intl.NumberFormat('zh-TW').format(n))
const formatMoney = (n) => (n == null || n === 0 ? '—' : `$${formatNumber(n)}`)

const ImportTradesModal = ({ visible, onClose, onImported }) => {
  const fileInputRef = useRef(null)
  const {
    step,
    file,
    sourceName,
    setSourceName,
    fields,
    requiredFields,
    missingRequired,
    mapping,
    savedMappingApplied,
    analysis,
    result,
    loading,
    importing,

    chooseFile,
    loadSavedMapping,
    setMappingField,
    resetMappingToSuggested,
    toMapping,
    toPreview,
    commit,
    back,
    reset,
  } = useTradeImport()

  // 完成步驟沒有對應的 Steps 項目，給 3 讓三步都顯示為已完成
  const stepIndex = { upload: 0, mapping: 1, preview: 2, done: 3 }[step] ?? 0

  /** 統一處理 hook 回傳的 err：訊息來自後端，直接顯示給使用者 */
  const run = async (action) => {
    const { err, result: data } = await action()
    if (err) {
      message.error(err.message || '操作失敗')
      return null
    }
    return data
  }

  const handleFileChange = async (e) => {
    const picked = e.target.files?.[0]
    // 清掉 value，同一個檔案才能再選一次（例如先選錯來源名稱後重來）
    e.target.value = ''
    if (!picked) return

    const lower = picked.name.toLowerCase()
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      message.error(`不支援的檔案格式，請上傳 ${ALLOWED_EXTENSIONS.join(' / ')} 檔`)
      return
    }
    if (picked.size > MAX_FILE_BYTES) {
      message.error('檔案超過 10MB 上限')
      return
    }
    await chooseFile(picked)
  }

  const handleToMapping = () => run(toMapping)
  const handleToPreview = () => run(toPreview)

  const handleCommit = async () => {
    const data = await run(commit)
    if (data) onImported?.(data)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // 預覽列：問題列整列淡紅底，狀態欄直接寫出原因
  const previewColumns = [
    { title: '列', dataIndex: 'rowNumber', width: 48, align: 'right' },
    {
      // 後端預覽列的 timestamp 已經是格式化好的字串（無效列為 null）
      title: '日期',
      dataIndex: 'timestamp',
      width: 148,
      render: (v) => v || <span className='import-muted'>—</span>,
    },
    { title: '代號', dataIndex: 'symbol', width: 72 },
    { title: '名稱', dataIndex: 'name', width: 84, ellipsis: true },
    { title: '動作', dataIndex: 'actionLabel', width: 56 },
    { title: '股數', dataIndex: 'shares', width: 76, align: 'right', render: formatNumber },
    { title: '價格', dataIndex: 'price', width: 76, align: 'right', render: formatNumber },
    {
      title: '狀態',
      key: 'status',
      render: (_, row) => {
        if (row.status === 'invalid') {
          return <Tag color="error">{row.errors?.join('；') || '無法解析'}</Tag>
        }
        if (row.status === 'duplicate') return <Tag>重複，會略過</Tag>
        return <Tag color="success">可匯入</Tag>
      },
    },
  ]

  const summary = analysis?.summary
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]))
  const mappedHeaders = new Set(Object.values(mapping))
  const headers = analysis?.headers ?? []

  // ------------------------------------------------------------------ 各步驟內容

  const renderUpload = () => (
    <div>
      <div className='import-dropzone' onClick={() => fileInputRef.current?.click()}>
        <InboxOutlined className='import-dropzone-icon' />
        <Button className='rounded-sm' icon={<FileTextOutlined />}>
          選擇檔案
        </Button>
        <span className='import-dropzone-hint'>
          支援 {ALLOWED_EXTENSIONS.join(' / ')}，單檔 10MB 以內
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {file && (
        <div className='import-file-row'>
          <FileTextOutlined />
          <span>{file.name}</span>
          <span className='import-muted'>({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      <div className='mt-md'>
        <div className='mb-xs' style={{ fontSize: 13 }}>來源名稱</div>
        <Input
          className='rounded-sm'
          placeholder='例如：元大證券'
          value={sourceName}
          maxLength={60}
          onChange={(e) => setSourceName(e.target.value)}
          onBlur={() => loadSavedMapping(sourceName)}
          disabled={!file}
        />
        <div className='import-dropzone-hint mt-xs'>
          用來記住這份來源的欄位對應，下次匯入同來源可一鍵套用。
        </div>
      </div>

      {savedMappingApplied && (
        <Alert
          className='mt-md'
          type="info"
          showIcon
          message={`已套用「${sourceName}」先前儲存的欄位對應`}
        />
      )}
    </div>
  )

  const renderMapping = () => (
    <div>
      <Alert
        type="info"
        showIcon
        message={
          <span>
            必填欄位：
            {requiredFields.map((key) => fieldByKey[key]?.label || key).join('、')}
            。沒對到的欄位請手動選擇，其餘欄位留空即可。
          </span>
        }
      />

      <div className='useBetween mt-md mb-sm'>
        <span style={{ fontSize: 13 }}>
          表頭列：第 {(analysis?.headerRowIndex ?? 0) + 1} 列
          {analysis?.sheetName ? `（工作表：${analysis.sheetName}）` : ''}
        </span>
        <Button
          size="small"
          className='rounded-sm'
          icon={<ReloadOutlined />}
          onClick={() => run(resetMappingToSuggested)}
        >
          重新猜測
        </Button>
      </div>

      <div className='import-mapping-list'>
        {fields.map((field) => (
          <div className='import-mapping-row' key={field.key}>
            <div className='import-mapping-field'>
              <span className='import-mapping-label'>
                {field.label}
                {field.required && <span className='import-required-mark'>*</span>}
              </span>
              {field.description && (
                <span className='import-mapping-desc'>{field.description}</span>
              )}
            </div>
            <Select
              className='rounded-sm'
              style={{ width: 220 }}
              placeholder='未對應'
              allowClear
              value={mapping[field.key] ?? undefined}
              onChange={(value) => setMappingField(field.key, value)}
              options={headers.map((header) => ({
                value: header,
                label: header,
                // 已被其他欄位用掉的表頭標示出來，避免重複對應
                disabled: mappedHeaders.has(header) && mapping[field.key] !== header,
              }))}
            />
          </div>
        ))}
      </div>

      {analysis?.unmappedColumns?.length > 0 && (
        <div className='mt-md'>
          <span className='import-muted' style={{ fontSize: 12 }}>
            檔案中未使用的欄位：
          </span>
          {analysis.unmappedColumns.map((header) => (
            <Tag key={header} className='ml-xs'>{header}</Tag>
          ))}
        </div>
      )}

      {missingRequired.length > 0 && (
        <Alert
          className='mt-md'
          type="warning"
          showIcon
          message={`尚未對應必填欄位：${missingRequired
            .map((key) => fieldByKey[key]?.label || key)
            .join('、')}`}
        />
      )}
    </div>
  )

  const renderPreview = () => (
    <div>
      <div className='import-summary'>
        <Statistic title='總列數' value={summary?.totalRows ?? 0} valueStyle={{ fontSize: 18 }} />
        <Statistic
          title='可匯入'
          value={summary?.importableCount ?? 0}
          valueStyle={{ fontSize: 18, color: 'var(--color-up)' }}
        />
        <Statistic
          title='重複略過'
          value={summary?.duplicateCount ?? 0}
          valueStyle={{ fontSize: 18, color: 'var(--text-secondary)' }}
        />
        <Statistic
          title='無法解析'
          value={summary?.invalidCount ?? 0}
          valueStyle={{
            fontSize: 18,
            color: summary?.invalidCount > 0 ? 'var(--color-down)' : undefined,
          }}
        />
        <Statistic title='新增交易' value={summary?.newTradeCount ?? 0} valueStyle={{ fontSize: 18 }} />
      </div>

      {summary?.depositAmount > 0 && (
        <Alert
          className='mb-sm'
          type="info"
          showIcon
          message={`這批是淨買超，會自動補一筆入金 ${formatMoney(summary.depositAmount)}，匯入前後的現金餘額不變。`}
        />
      )}
      {summary?.invalidCount > 0 && (
        <Alert
          className='mb-sm'
          type="warning"
          showIcon
          message={`有 ${summary.invalidCount} 列無法解析（紅底列），匯入時會跳過，其餘照常寫入。`}
        />
      )}
      {summary?.orphanSellCount > 0 && (
        <Alert
          className='mb-sm'
          type="warning"
          showIcon
          message={`有 ${summary.orphanSellCount} 筆賣出在前面找不到對應的買進，會各自獨立成一筆交易，損益沒有成本可以扣。`}
        />
      )}
      {summary?.truncated && (
        <Alert
          className='mb-sm'
          type="warning"
          showIcon
          message='檔案列數超過解析上限，僅匯入前面部分，請分批匯入。'
        />
      )}
      {summary?.importableCount === 0 && (
        <Alert
          className='mb-sm'
          type="info"
          showIcon
          message='這批沒有新資料，確認後不會寫入任何交易，只會記住這組欄位對應。'
        />
      )}

      <Table
        size="small"
        rowKey='rowNumber'
        columns={previewColumns}
        dataSource={analysis?.rows ?? []}
        pagination={false}
        scroll={{ y: 300 }}
        rowClassName={(row) => (row.status === 'invalid' ? 'import-row-invalid' : '')}
      />

      {analysis?.hasMoreRows && (
        <div className='import-dropzone-hint mt-sm'>
          僅顯示前 {analysis.previewLimit} 列，其餘會在確認後一併匯入。
        </div>
      )}
    </div>
  )

  const renderDone = () => {
    const noop = !result?.batchId
    return (
      <div className='import-result'>
        <CheckCircleOutlined
          className='import-result-icon'
          style={noop ? { color: 'var(--text-secondary)' } : undefined}
        />
        <span className='import-result-title'>
          {noop ? '沒有新資料，未寫入任何交易' : `成功匯入 ${result?.summary?.importableCount ?? 0} 筆`}
        </span>
        {!noop && (
          <span className='import-muted'>
            新增 {result?.summary?.newTradeCount ?? 0} 筆交易
            {result?.summary?.duplicateCount > 0 && `，略過 ${result.summary.duplicateCount} 筆重複`}
            {result?.summary?.invalidCount > 0 && `，跳過 ${result.summary.invalidCount} 筆無法解析`}
          </span>
        )}
        {result?.depositAmount > 0 && (
          <Alert
            type="info"
            showIcon
            message={`已自動補入金 ${formatMoney(result.depositAmount)}`}
            description={result.depositDate && `入金日期：${result.depositDate}`}
          />
        )}
        {result?.savedMapping && (
          <span className='import-muted'>
            欄位對應已儲存，下次匯入「{result.sourceName}」會自動套用。
          </span>
        )}
      </div>
    )
  }

  const renderBody = () => {
    if (step === 'upload') return renderUpload()
    if (step === 'mapping') return renderMapping()
    if (step === 'preview') return renderPreview()
    return renderDone()
  }

  const footer = () => {
    if (step === 'upload') {
      return [
        <Button key='cancel' className='rounded-sm' onClick={handleClose}>取消</Button>,
        <Button
          key='next'
          type="primary"
          className='rounded-sm'
          disabled={!file}
          loading={loading}
          onClick={handleToMapping}
        >
          下一步
        </Button>,
      ]
    }
    if (step === 'mapping') {
      return [
        <Button key='back' className='rounded-sm' onClick={back}>上一步</Button>,
        <Tooltip
          key='preview'
          title={missingRequired.length > 0 ? '請先對應所有必填欄位' : ''}
        >
          <Button
            type="primary"
            className='rounded-sm'
            disabled={missingRequired.length > 0}
            loading={loading}
            onClick={handleToPreview}
          >
            預覽
          </Button>
        </Tooltip>,
      ]
    }
    if (step === 'preview') {
      return [
        <Button key='back' className='rounded-sm' onClick={back}>上一步</Button>,
        <Button
          key='commit'
          type="primary"
          className='rounded-sm'
          loading={importing}
          onClick={handleCommit}
        >
          {summary?.importableCount > 0 ? `確認匯入 ${summary.importableCount} 筆` : '確認'}
        </Button>,
      ]
    }
    return [
      <Button key='again' className='rounded-sm' onClick={reset}>再匯入一筆</Button>,
      <Button key='done' type="primary" className='rounded-sm' onClick={handleClose}>完成</Button>,
    ]
  }

  return (
    <Modal
      title='匯入交易紀錄'
      open={visible}
      onCancel={handleClose}
      className='import-trades-modal'
      width={760}
      footer={footer()}
      destroyOnHidden
    >
      <Steps
        className='mb-md'
        size="small"
        current={stepIndex}
        items={[
          { title: '上傳檔案' },
          { title: '欄位對應' },
          { title: '預覽確認' },
        ]}
      />
      <Spin spinning={loading && step === 'upload'}>
        {renderBody()}
      </Spin>
    </Modal>
  )
}

export default ImportTradesModal
