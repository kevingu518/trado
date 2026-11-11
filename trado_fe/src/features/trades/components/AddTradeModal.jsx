// src/features/trades/components/AddTradeModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, message, Segmented, Switch, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useStrategies } from '@/features/strategies/hooks/useStrategies'
import CategoryTag from '@/features/stockCategories/components/CategoryTag'

const { Option } = Select

const AddTradeModal = ({
  visible,
  onClose,
  onSave,
  tradeId = null, // 編輯模式時傳入 tradeId
  initialData = null, // 編輯模式時傳入初始資料
  // 族群資料由父層（交易紀錄頁）共用同一份 state 傳入，
  // 確保建立後寫入的 symbol→族群 對應能立即反映在表格上
  stockCategories = [],
  symbolCategoryMap = {},
  setSymbolCategory = () => Promise.resolve({ err: null }),
}) => {
  const [form] = Form.useForm()
  const symbolInputRef = useRef(null)
  const priceInputRef = useRef(null)
  const isEditMode = !!tradeId
  // withPosition 用 local state 而非 useWatch（後者對未透過 Form.Item 註冊的欄位不穩定）
  const [withPosition, setWithPosition] = useState(true)
  const withDeposit = Form.useWatch('withDeposit', form)
  const positionShares = Form.useWatch('positionShares', form)
  const positionPrice = Form.useWatch('positionPrice', form)
  const symbolValue = Form.useWatch('symbol', form)

  // 獲取策略列表（只獲取啟用的策略）
  const { data: strategiesData, loading: strategiesLoading } = useStrategies(
    { isActive: true }, // 只獲取啟用的策略
    visible // 只在 modal 打開時才獲取
  )

  // 將策略列表轉換為 Select 選項格式
  // 系統「未分類」策略以正常選項呈現（排首位），不另設「無」選項，避免兩個入口指向同一個 bucket
  const strategyOptions = useMemo(() => {
    if (!strategiesData?.list) return []

    const active = strategiesData.list.filter(s => s.isActive)
    const system = active.filter(s => s.isSystem)
    const userStrategies = active.filter(s => !s.isSystem)

    return [...system, ...userStrategies].map(s => ({
      value: s.id,
      label: s.name,
    }))
  }, [strategiesData])

  // 系統「未分類」策略 id（用於預設值 / fallback）
  const systemStrategyId = useMemo(() => {
    return strategiesData?.list?.find(s => s.isSystem)?.id || null
  }, [strategiesData])

  // symbol 變動時，自動帶入既有族群歸類
  useEffect(() => {
    if (!visible) return
    if (!symbolValue || symbolValue.length !== 4) return
    const mappedId = symbolCategoryMap[symbolValue]
    // 已有歸類 → 自動帶入；尚未歸類則不動使用者的選擇
    if (mappedId) {
      const current = form.getFieldValue('category')
      if (current !== mappedId) {
        form.setFieldsValue({ category: mappedId })
      }
    }
  }, [symbolValue, symbolCategoryMap, visible, form])

  // 開啟「同步補入金」時，預設金額帶入買入成本（股數 × 價格）
  useEffect(() => {
    if (withDeposit && positionShares && positionPrice) {
      const current = form.getFieldValue('depositAmount')
      if (current == null || current === '') {
        form.setFieldsValue({ depositAmount: Math.round(positionShares * positionPrice) })
      }
    }
  }, [withDeposit, positionShares, positionPrice, form])

  // 切換「同時建立倉位」OFF→ON 時，自動 focus 到價格欄位（初始開啟時不搶 focus，
  // 因為 modal afterOpenChange 已 focus 股號）
  const prevWithPositionRef = useRef(undefined)
  useEffect(() => {
    if (
      visible && !isEditMode && withPosition &&
      prevWithPositionRef.current === false
    ) {
      const id = setTimeout(() => priceInputRef.current?.focus(), 0)
      prevWithPositionRef.current = withPosition
      return () => clearTimeout(id)
    }
    prevWithPositionRef.current = withPosition
  }, [visible, isEditMode, withPosition])

  // 開啟 modal 時重置表單一次（只依賴 visible / isEditMode / initialData，
  // 避免 strategies / categories 載入完成觸發再次 reset 而清掉使用者選擇）
  useEffect(() => {
    if (!visible) return
    if (isEditMode && initialData) {
      form.setFieldsValue({
        symbol: initialData.symbol,
        direction: initialData.direction,
        createdAt: initialData.createdAt ? dayjs(initialData.createdAt) : null,
      })
    } else if (!isEditMode) {
      form.resetFields()
      form.setFieldsValue({
        direction: 'long',
        category: null,
        withDeposit: false,
        createdAt: dayjs(),
      })
      setWithPosition(true)
    }
  }, [visible, isEditMode, initialData, form])

  // 策略資料載入後，填入策略預設值（不覆蓋已有選擇）
  useEffect(() => {
    if (!visible) return
    if (isEditMode && initialData) {
      // 編輯模式：根據 initialData 解析策略
      let strategyValue = systemStrategyId
      if (initialData.strategyId && strategyOptions.some(opt => opt.value === initialData.strategyId)) {
        strategyValue = initialData.strategyId
      } else if (initialData.strategy) {
        const matchedStrategy = strategyOptions.find(opt => opt.label === initialData.strategy)
        if (matchedStrategy) strategyValue = matchedStrategy.value
      }
      if (strategyValue && form.getFieldValue('strategy') !== strategyValue) {
        form.setFieldsValue({ strategy: strategyValue })
      }
    } else if (!isEditMode) {
      // 新增模式：未選過策略才預設為系統「未分類」
      if (systemStrategyId && !form.getFieldValue('strategy')) {
        form.setFieldsValue({ strategy: systemStrategyId })
      }
    }
  }, [visible, isEditMode, initialData, form, strategyOptions, systemStrategyId])

  // 編輯模式：symbol 對應的族群資料載入後，自動帶入
  useEffect(() => {
    if (!visible || !isEditMode || !initialData?.symbol) return
    const mapped = symbolCategoryMap[initialData.symbol] || null
    if (mapped && form.getFieldValue('category') !== mapped) {
      form.setFieldsValue({ category: mapped })
    }
  }, [visible, isEditMode, initialData, symbolCategoryMap, form])

  // 處理保存
  const handleSave = async () => {
    try {
      // 編輯模式時，只驗證已填寫的欄位（非必填）
      // 新增模式時，驗證所有必填欄位
      const values = isEditMode
        ? await form.validateFields().catch(() => form.getFieldsValue()) // 編輯模式：即使驗證失敗也取得表單值
        : await form.validateFields() // 新增模式：嚴格驗證

      // 策略 id 是 UUID（字串）；若清空則送 null（後端會自動導向系統「未分類」策略）
      const strategyIdValue = values.strategy || null

      // 編輯模式：送出所有已填欄位（包含 strategyId: null 以支援「清除策略」）
      const tradeData = isEditMode
        ? {
            ...(values.symbol && { symbol: values.symbol }),
            ...(values.direction && { direction: values.direction }),
            ...(values.strategy !== undefined && { strategyId: strategyIdValue }),
            ...(values.createdAt && { createdAt: values.createdAt.format('YYYY-MM-DD') }),
          }
        : {
            symbol: values.symbol,
            direction: values.direction,
            strategyId: strategyIdValue,
            createdAt: values.createdAt ? values.createdAt.format('YYYY-MM-DD') : null,
          }

      // 組裝倉位資料（新增模式 + 開啟同時建立倉位）
      let positionData = null
      if (!isEditMode && withPosition) {
        positionData = {
          action: values.direction === 'long' ? 'buy' : 'sell',
          shares: values.positionShares,
          price: values.positionPrice,
          date: values.createdAt ? values.createdAt.format('YYYY-MM-DD') : null, // 直接用開倉日
          stopLoss: values.positionStopLoss || null,
          note: values.positionNote || null,
        }
      }

      // 組裝同步補入金資料（須同時建立倉位才會啟用）
      let depositData = null
      if (!isEditMode && withPosition && values.withDeposit && values.depositAmount > 0) {
        depositData = {
          amount: values.depositAmount,
          date: values.createdAt ? values.createdAt.format('YYYY-MM-DD') : null,
          method: null,
          notes: '補單同步入金',
        }
      }

      // 如果是編輯模式，需要傳入 tradeId
      if (isEditMode) {
        await onSave(tradeId, tradeData)
      } else {
        await onSave(tradeData, positionData, depositData)
      }

      // 設定 / 更新 symbol 的族群歸類（若使用者有選擇且與現況不同）
      const targetSymbol = values.symbol || initialData?.symbol
      if (targetSymbol && values.category !== undefined) {
        const currentMapped = symbolCategoryMap[targetSymbol] || null
        const next = values.category || null
        if (next && next !== currentMapped) {
          // fire and forget — 失敗不阻擋 trade 建立
          setSymbolCategory(targetSymbol, next).catch(() => {})
        }
      }

      form.resetFields()
      onClose()
    } catch (error) {
      console.error('保存失敗:', error)
      if (!isEditMode) {
        // 新增模式時才顯示驗證錯誤
        message.error('請檢查表單欄位')
      }
    }
  }

  // 處理取消
  const handleCancel = () => {
    form.resetFields()
    setWithPosition(true)
    onClose()
  }

  return (
    <Modal
      title={
        <div className='add-trade-modal-title'>
          <span>{isEditMode ? '編輯交易記錄' : '新增交易記錄'}</span>
          {!isEditMode && (
            <Space size={6} align="center">
              <Switch
                size="small"
                checked={withPosition}
                onChange={setWithPosition}
              />
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                同時建立倉位
              </span>
            </Space>
          )}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      afterOpenChange={(open) => {
        if (open) symbolInputRef.current?.focus()
      }}
      className='add-trade-modal'
      width={560}
      footer={[
        <Button key="cancel" onClick={handleCancel} size="middle" style={{ borderRadius: '4px' }}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={isEditMode ? <EditOutlined /> : null}
          onClick={handleSave}
          size="middle"
          style={{ borderRadius: '4px' }}
        >
          {isEditMode ? '保存' : '新增'}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="多空"
          name="direction"
          rules={isEditMode ? [] : [{ required: true, message: '請選擇多空' }]} // 編輯模式時非必填
          initialValue="long"
        >
          <Segmented
            options={[
              { label: '多', value: 'long' },
              { label: '空', value: 'short' }
            ]}
            block
            style={{ borderRadius: '4px' }}
          />
        </Form.Item>

        <div className='useBetween gap-md'>
          <Form.Item
            label="股號"
            name="symbol"
            className='flex-1'
            rules={[
              ...(isEditMode ? [] : [{ required: true, message: '請輸入股號' }]), // 編輯模式時非必填
              { pattern: /^[0-9]{4}$/, message: '股號必須為4位數字' }
            ]}
          >
            <Input
              ref={symbolInputRef}
              placeholder="請輸入4位數字股號"
              maxLength={4}
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>

          <Form.Item
            label="開倉日"
            name="createdAt"
            className='flex-1'
            rules={isEditMode ? [] : [{ required: true, message: '請選擇開倉日' }]} // 編輯模式時非必填
          >
            <DatePicker
              placeholder="選擇開倉日"
              style={{ width: '100%', borderRadius: '4px' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>
        </div>

        <div className='useBetween gap-md'>
          <Form.Item
            label="策略"
            name="strategy"
            className='flex-1'
            rules={isEditMode ? [] : [{ required: true, message: '請選擇策略' }]} // 編輯模式時非必填
          >
            <Select
              placeholder="請選擇策略"
              loading={strategiesLoading}
            >
              {strategyOptions.map(strategy => (
                <Option key={strategy.value} value={strategy.value}>
                  {strategy.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="族群"
            name="category"
            className='flex-1'
          >
            <Select
              placeholder="搜尋族群"
              allowClear
              showSearch
              optionFilterProp="label"
              optionLabelProp="label"
              popupMatchSelectWidth={false}
            >
              {stockCategories.map((c) => (
                <Option key={c.id} value={c.id} label={c.name}>
                  <CategoryTag color={c.color} size="sm">{c.name}</CategoryTag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        {!isEditMode && withPosition && (
          <>
            <div className='useBetween gap-md'>
              <Form.Item
                label="價格"
                name="positionPrice"
                className='flex-1'
                rules={[
                  { required: true, message: '請輸入價格' },
                  { type: 'number', min: 0, message: '價格必須大於0' }
                ]}
              >
                <InputNumber
                  ref={priceInputRef}
                  placeholder="請輸入價格"
                  style={{ width: '100%', borderRadius: '4px' }}
                  min={0}
                  precision={2}
                  addonBefore="$"
                />
              </Form.Item>

              <Form.Item
                label="數量"
                name="positionShares"
                className='flex-1'
                rules={[
                  { required: true, message: '請輸入數量' },
                  { type: 'number', min: 1, message: '數量必須大於0' }
                ]}
              >
                <InputNumber
                  placeholder="請輸入數量"
                  style={{ width: '100%', borderRadius: '4px' }}
                  min={1}
                  precision={0}
                  addonAfter="股"
                  onPressEnter={handleSave}
                />
              </Form.Item>
            </div>

            <div className='useBetween gap-md'>
              <Form.Item
                label={
                  <span className='useCenter gap-xs'>
                    停損價 <span className='optional-tag'>選填</span>
                    <Tooltip title="填了才能算 R 值（每單位盈虧 ÷ 進場價到停損價的距離）。儀表板用它算平均 R、R 分布與停損遵守率">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </span>
                }
                name="positionStopLoss"
                className='flex-1'
                rules={[
                  { type: 'number', min: 0, message: '停損價必須大於0' }
                ]}
              >
                <InputNumber
                  placeholder="例：進場 100、停損 95 → 1R = 5 元"
                  style={{ width: '100%', borderRadius: '4px' }}
                  min={0}
                  precision={2}
                  addonBefore="$"
                />
              </Form.Item>

              <Form.Item
                label={<>備註 <span className='optional-tag'>選填</span></>}
                name="positionNote"
                className='flex-1'
              >
                <Input
                  placeholder="例：突破整理區買進"
                  style={{ borderRadius: '4px' }}
                />
              </Form.Item>
            </div>

            <div className={`deposit-block ${withDeposit ? 'is-expanded' : ''}`}>
              <Form.Item
                name="withDeposit"
                valuePropName="checked"
                className='deposit-toggle'
              >
                <Space align="center">
                  <Switch
                    size="small"
                    checked={withDeposit}
                    onChange={(checked) => form.setFieldsValue({ withDeposit: checked })}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    同步補入金
                  </span>
                </Space>
              </Form.Item>

              {withDeposit && (
                <Form.Item
                  label="入金金額"
                  name="depositAmount"
                  rules={[
                    { required: true, message: '請輸入入金金額' },
                    { type: 'number', min: 1, message: '入金金額必須大於 0' },
                  ]}
                  extra="補歷史單時避免現金變負；預設為買入成本（股數 × 價格），可自行調整"
                >
                  <InputNumber
                    placeholder="入金金額"
                    style={{ width: '100%', borderRadius: '4px' }}
                    min={1}
                    precision={0}
                    addonBefore="$"
                  />
                </Form.Item>
              )}
            </div>
          </>
        )}
      </Form>
    </Modal>
  )
}

export default AddTradeModal
