// src/features/trades/components/AddTradeModal.jsx
import React, { useEffect, useMemo } from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, message, Segmented, Switch } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useStrategies } from '@/features/strategies/hooks/useStrategies'

const { Option } = Select

const AddTradeModal = ({
  visible,
  onClose,
  onSave,
  tradeId = null, // 編輯模式時傳入 tradeId
  initialData = null // 編輯模式時傳入初始資料
}) => {
  const [form] = Form.useForm()
  const isEditMode = !!tradeId
  const withPosition = Form.useWatch('withPosition', form)

  // 獲取策略列表（只獲取啟用的策略）
  const { data: strategiesData, loading: strategiesLoading } = useStrategies(
    { isActive: true }, // 只獲取啟用的策略
    visible // 只在 modal 打開時才獲取
  )

  // 將策略列表轉換為 Select 選項格式
  const strategyOptions = useMemo(() => {
    const options = [
      { value: 'none', label: '無' } // 保留"無"選項
    ]
    
    if (strategiesData?.list) {
      const activeStrategies = strategiesData.list
        .filter(strategy => strategy.isActive) // 再次過濾確保只顯示啟用的
        .map(strategy => ({
          value: strategy.id, // 使用策略 ID 作為 value
          label: strategy.name // 使用策略名稱作為 label
        }))
      
      options.push(...activeStrategies)
    }
    
    return options
  }, [strategiesData])

  // 初始化表單資料（編輯模式）
  useEffect(() => {
    if (visible && isEditMode && initialData) {
      // 處理策略欄位：可能是策略 ID、策略名稱或 null
      let strategyValue = 'none'
      if (initialData.strategyId) {
        strategyValue = initialData.strategyId
      } else if (initialData.strategy) {
        // 如果是策略名稱，嘗試找到對應的 ID
        const matchedStrategy = strategyOptions.find(opt => opt.label === initialData.strategy)
        strategyValue = matchedStrategy ? matchedStrategy.value : 'none'
      }
      
      form.setFieldsValue({
        symbol: initialData.symbol,
        direction: initialData.direction,
        strategy: strategyValue,
        createdAt: initialData.createdAt ? dayjs(initialData.createdAt) : null,
      })
    } else if (visible && !isEditMode) {
      // 新增模式時重置表單
      form.resetFields()
      form.setFieldsValue({
        direction: 'long',
        strategy: 'none',
        withPosition: false,
        createdAt: dayjs(),
      })
    }
  }, [visible, isEditMode, initialData, form, strategyOptions])

  // 處理保存
  const handleSave = async () => {
    try {
      // 編輯模式時，只驗證已填寫的欄位（非必填）
      // 新增模式時，驗證所有必填欄位
      const values = isEditMode 
        ? await form.validateFields().catch(() => form.getFieldsValue()) // 編輯模式：即使驗證失敗也取得表單值
        : await form.validateFields() // 新增模式：嚴格驗證

      // 處理策略欄位：如果選擇的是策略 ID（數字），使用 strategyId；如果是 'none'，設為 null
      let strategyValue = null
      let strategyIdValue = null
      
      if (values.strategy && values.strategy !== 'none') {
        if (typeof values.strategy === 'number') {
          // 如果是數字，當作 strategyId
          strategyIdValue = values.strategy
        } else {
          // 如果是字符串，可能是策略名稱（向後兼容）
          strategyValue = values.strategy
        }
      }

      // 編輯模式：只發送有值的欄位
      const tradeData = isEditMode
        ? {
            ...(values.symbol && { symbol: values.symbol }),
            ...(values.direction && { direction: values.direction }),
            ...(strategyIdValue !== null && { strategyId: strategyIdValue }),
            ...(strategyValue !== null && { strategy: strategyValue }),
            ...(values.createdAt && { createdAt: values.createdAt.format('YYYY-MM-DD') }),
          }
        : {
            symbol: values.symbol,
            direction: values.direction,
            strategyId: strategyIdValue,
            strategy: strategyValue,
            createdAt: values.createdAt ? values.createdAt.format('YYYY-MM-DD') : null,
          }

      // 組裝倉位資料（新增模式 + 開啟同時建立倉位）
      let positionData = null
      if (!isEditMode && values.withPosition) {
        positionData = {
          action: values.direction === 'long' ? 'buy' : 'sell',
          shares: values.positionShares,
          price: values.positionPrice,
          date: values.createdAt, // 直接用開倉日
          stopLoss: values.positionStopLoss || null,
          note: values.positionNote || null,
        }
      }

      // 如果是編輯模式，需要傳入 tradeId
      if (isEditMode) {
        await onSave(tradeId, tradeData)
      } else {
        await onSave(tradeData, positionData)
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
    onClose()
  }

  return (
    <Modal
      title={isEditMode ? "編輯交易記錄" : "新增交易記錄"}
      open={visible}
      onCancel={handleCancel}
      className='add-trade-modal'
      width={640}
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
            label="多空"
            name="direction"
            className='flex-1'
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

          <Form.Item
            label="策略"
            name="strategy"
            className='flex-1'
            rules={isEditMode ? [] : [{ required: true, message: '請選擇策略' }]} // 編輯模式時非必填
            initialValue="none"
          >
            <Select 
              placeholder="請選擇策略"
              className='rounded-xs'
              style={{ borderRadius: '4px' }}
              loading={strategiesLoading}
            >
              {strategyOptions.map(strategy => (
                <Option key={strategy.value} value={strategy.value}>
                  {strategy.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        {/* 同時建立倉位（僅新增模式） */}
        {!isEditMode && (
          <>
            <Form.Item
              name="withPosition"
              valuePropName="checked"
              style={{ marginBottom: withPosition ? 16 : 0 }}
            >
              <Space align="center">
                <Switch
                  size="small"
                  checked={withPosition}
                  onChange={(checked) => form.setFieldsValue({ withPosition: checked })}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>同時建立首筆倉位</span>
              </Space>
            </Form.Item>

            {withPosition && (
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
                    />
                  </Form.Item>
                </div>

                <div className='useBetween gap-md'>
                  <Form.Item
                    label="停損價"
                    name="positionStopLoss"
                    className='flex-1'
                    rules={[
                      { type: 'number', min: 0, message: '停損價必須大於0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="選填"
                      style={{ width: '100%', borderRadius: '4px' }}
                      min={0}
                      precision={2}
                      addonBefore="$"
                    />
                  </Form.Item>

                  <Form.Item
                    label="備註"
                    name="positionNote"
                    className='flex-1'
                  >
                    <Input
                      placeholder="選填"
                      style={{ borderRadius: '4px' }}
                    />
                  </Form.Item>
                </div>
              </>
            )}
          </>
        )}
      </Form>
    </Modal>
  )
}

export default AddTradeModal
