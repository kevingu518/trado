import { useState, useCallback } from 'react'
import { to } from 'await-to-js'
import { tradeImportService, defaultSourceName } from '../services/tradeImport'

/**
 * 匯入精靈的狀態機（TD-112）
 *
 *   upload（選檔 + 來源名稱）
 *     └─ 預覽一次（不帶 mapping）只是為了拿到表頭與建議對應
 *   mapping（逐欄對應，必填沒對完不能往下）
 *     └─ 帶著確定的 mapping 再預覽一次，這次的統計才是準的
 *   preview（確認統計與問題列）
 *   done（寫入結果）
 *
 * 為什麼要預覽兩次：表頭要解析檔案才知道，而 mapping 又得等表頭出來才能選。
 * 第一次預覽同時回傳後端猜好的對應，使用者通常只需要微調。
 *
 * 不寫入任何資料直到 commit —— 這是驗收條件，所以 preview 只讀不寫，
 * 精靈中途關掉不會留下任何痕跡（除了已存的欄位對應）。
 */
export const IMPORT_STEPS = ['upload', 'mapping', 'preview', 'done']

export const useTradeImport = () => {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [fields, setFields] = useState([])
  const [requiredFields, setRequiredFields] = useState([])
  const [mapping, setMapping] = useState({})
  const [analysis, setAnalysis] = useState(null)
  const [result, setResult] = useState(null)
  const [savedMappingApplied, setSavedMappingApplied] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  // 欄位定義全站固定，抓一次就好
  const loadFields = useCallback(async () => {
    if (fields.length > 0) return
    const [err, data] = await to(tradeImportService.fetchFields())
    if (err) {
      setError(err)
      return
    }
    setFields(data?.fields ?? [])
    setRequiredFields(data?.requiredFields ?? [])
  }, [fields.length])

  /** 選檔：順手把「這個來源上次怎麼對」撈出來，並預設來源名稱＝檔名 */
  const chooseFile = useCallback(async (nextFile) => {
    setError(null)
    setResult(null)
    setAnalysis(null)
    setFile(nextFile)
    setMapping({})
    setSavedMappingApplied(false)

    if (!nextFile) {
      setSourceName('')
      return
    }
    setSourceName(defaultSourceName(nextFile.name))
    await loadFields()
  }, [loadFields])

  /**
   * 來源名稱改了 → 換一套已存的對應。
   * 只在「還沒自己動手改過對應」的階段有意義，所以呼叫端是來源名稱輸入框的
   * onBlur，不是每個字都打一次 API。
   */
  const loadSavedMapping = useCallback(async (name) => {
    const [err, saved] = await to(tradeImportService.fetchSavedMapping(name))
    if (err) return null // 撈不到就當作沒存過，不擋流程
    setSavedMappingApplied(Boolean(saved))
    if (saved) setMapping(saved)
    return saved
  }, [])

  /**
   * upload → mapping：先解析出表頭與建議對應。
   * 已存過的對應優先於後端猜測（使用者上次確認過的比較準）。
   */
  const toMapping = useCallback(async () => {
    if (!file) return { err: new Error('請先選擇檔案'), result: null }
    setLoading(true)
    setError(null)

    const [err, data] = await to(tradeImportService.preview({ file }))
    if (err) {
      setError(err)
      setLoading(false)
      return { err, result: null }
    }

    setAnalysis(data)

    // 來源名稱可能在使用者選檔後被改過，這裡以當下的值為準
    const saved = await loadSavedMapping(sourceName)
    if (!saved) setMapping(data?.suggestedMapping ?? {})

    setStep('mapping')
    setLoading(false)
    return { err: null, result: data }
  }, [file, sourceName, loadSavedMapping])

  /** 重新依表頭猜一次（覆蓋掉目前手上的對應） */
  const resetMappingToSuggested = useCallback(async () => {
    const headers = analysis?.headers ?? []
    setError(null)
    const [err, guessed] = await to(tradeImportService.suggestMapping(headers))
    if (err) {
      setError(err)
      return { err, result: null }
    }
    setMapping(guessed ?? {})
    setSavedMappingApplied(false)
    return { err: null, result: guessed }
  }, [analysis])

  const setMappingField = useCallback((fieldKey, header) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (header === undefined || header === null || header === '') delete next[fieldKey]
      else next[fieldKey] = header
      return next
    })
  }, [])

  /** mapping → preview：這次帶上確定的對應，統計才是實際會發生的結果 */
  const toPreview = useCallback(async () => {
    if (!file) return { err: new Error('請先選擇檔案'), result: null }
    setLoading(true)
    setError(null)

    const [err, data] = await to(tradeImportService.preview({ file, mapping }))
    setLoading(false)
    if (err) {
      setError(err)
      return { err, result: null }
    }
    setAnalysis(data)
    setStep('preview')
    return { err: null, result: data }
  }, [file, mapping])

  /** 確認匯入（唯一會寫入資料的一步） */
  const commit = useCallback(async () => {
    if (!file) return { err: new Error('請先選擇檔案'), result: null }
    setImporting(true)
    setError(null)

    const [err, data] = await to(
      tradeImportService.importTrades({ file, mapping, sourceName })
    )
    setImporting(false)
    if (err) {
      setError(err)
      return { err, result: null }
    }
    setResult(data)
    setStep('done')
    return { err: null, result: data }
  }, [file, mapping, sourceName])

  const back = useCallback(() => {
    setError(null)
    setStep((prev) => {
      const idx = IMPORT_STEPS.indexOf(prev)
      return IMPORT_STEPS[Math.max(0, idx - 1)]
    })
  }, [])

  /** 回到第一步（可繼續匯入下一份檔案） */
  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setSourceName('')
    setMapping({})
    setAnalysis(null)
    setResult(null)
    setSavedMappingApplied(false)
    setError(null)
  }, [])

  // 必填欄位是否都對好了（前端先擋，後端也會再擋一次）
  const missingRequired = requiredFields.filter((key) => !mapping[key])

  return {
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
    error,
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
  }
}

export default useTradeImport
