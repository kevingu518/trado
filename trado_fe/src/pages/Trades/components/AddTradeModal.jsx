import React, { useState, useEffect } from 'react'
import { Segmented, Modal, Form, Input, InputNumber, DatePicker, Button, Row, Col, Space, Select, Card, Statistic, Divider } from 'antd'
import { createTradeApi } from '@api/api_trade'
import { to } from 'await-to-js'
import { message } from 'antd'
const AddTradeModal = ({ show, onClose, onSubmit }) => {
  // -------------------------   variables   ----------------------------
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [formValues, setFormValues] = useState({})
  const [calculations, setCalculations] = useState({
    cost: 0,
    stopLossEntryPrice: 0,
    stopLossLoss: 0
  })
  // -------------------------   functions   ----------------------------
  const handleSubmit = async (values) => {
    console.log({values})
    setLoading(true)
    try {
      // 格式化日期
      const formattedValues = {
        ...values,
        buyTime: values.buyTime ? values.buyTime.format('YYYY-MM-DD HH:mm:ss') : null,
        sellTime: values.sellTime ? values.sellTime.format('YYYY-MM-DD HH:mm:ss') : null,
        buyPrice: values.buyPrice ? values.buyPrice.toFixed(2) : null,
        sellPrice: values.sellPrice ? values.sellPrice.toFixed(2) : null,
        buyQuantity: values.buyQuantity ? values.buyQuantity.toFixed(0) : null,
        sellQuantity: values.sellQuantity ? values.sellQuantity.toFixed(0) : null,
        stopLossPrice: values.stopLossPrice ? values.stopLossPrice.toFixed(2) : null,
      }
      console.log({formattedValues})
      const [error, response] = await to(createTradeApi(formattedValues))
      if (error) {
        message.error(error.message)
        return
      }
      message.success('新增交易成功')
      // reset form
      // form.resetFields()
      // close modal
      // onClose()
    } catch (error) {
      console.error('提交失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setFormValues({})
    setCalculations({ cost: 0, stopLossEntryPrice: 0, stopLossLoss: 0 })
    onClose()
  }

  // 計算成本、停損進場價和停損損失
  const calculateValues = (values) => {
    const { 
      buyPrice = 0, 
      buyQuantity = 0, 
      sellPrice = 0, 
      sellQuantity = 0, 
      stopLossPrice = 0,
      tradeType = 'LONG'
    } = values

    let cost = 0
    let stopLossEntryPrice = 0
    let stopLossLoss = 0

    if (tradeType === 'LONG') {
      // 做多：買進成本
      if (buyPrice && buyQuantity) {
        cost = buyPrice * buyQuantity
        stopLossEntryPrice = buyPrice
        if (stopLossPrice) {
          stopLossLoss = (buyPrice - stopLossPrice) * buyQuantity
        }
      }
    } else {
      // 做空：賣出成本
      if (sellPrice && sellQuantity) {
        cost = sellPrice * sellQuantity
        stopLossEntryPrice = sellPrice
        if (stopLossPrice) {
          stopLossLoss = (stopLossPrice - sellPrice) * sellQuantity
        }
      }
    }

    return { cost, stopLossEntryPrice, stopLossLoss }
  }
  // 表單值變化處理
  const handleValuesChange = (changedValues, allValues) => {
    setFormValues(allValues)
    const newCalculations = calculateValues(allValues)
    setCalculations(newCalculations)
  }

  // 自定義驗證：買進或賣出至少要填一個
  const validateTradeData = (_, value) => {
    const { buyPrice, buyQuantity, sellPrice, sellQuantity } = form.getFieldsValue()
    const hasBuyData = buyPrice && buyQuantity
    const hasSellData = sellPrice && sellQuantity
    
    if (!hasBuyData && !hasSellData) {
      return Promise.reject(new Error('買進或賣出至少要填一個'))
    }
    return Promise.resolve()
  }
  // -------------------------   useEffect   ----------------------------
  // 監聽表單值變化
  useEffect(() => {
    const subscription = form.getFieldsValue()
    setFormValues(subscription)
    const newCalculations = calculateValues(subscription)
    setCalculations(newCalculations)
  }, [form])

  return (
      <Modal
        title="新增交易紀錄"
        open={show}
        onCancel={handleCancel}
        width={540}
        footer={null}
        className="add-trade-modal"
      >
        <Divider className='mt-sm mb-md bg-grey-100' plain/>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
          className="trade-form"
        >
          {/* 股號、多空選擇和停損價 */}
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="多空"
                name="tradeType"
                rules={[{ required: true, message: '請選擇多空' }]}
                initialValue="LONG"
              >
                <Segmented
                  className='bg-grey-200'
                  options={[
                    { label: '多', value: 'LONG' },
                    { label: '空', value: 'SHORT' }
                  ]}
                  block
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="股號"
                name="stockCode"
                rules={[
                  { required: true, message: '請輸入股號' },
                  { pattern: /^[0-9]{4}$/, message: '股號必須為4位數字' }
                ]}
              >
                <Input placeholder="請輸入股號" maxLength={7} className='rounded-sm' />
              </Form.Item>
            </Col>
            
            <Col span={6}>
              <Form.Item
                label="停損價"
                name="stopLossPrice"
                rules={[
                  { required: true, message: '請輸入停損價' },
                  { type: 'number', min: 0, message: '停損價必須大於0' }
                ]}
              >
                <InputNumber
                  placeholder="請輸入停損價"
                  style={{ width: '100%' }}
                  precision={2}
                  min={0}
                  className='rounded-sm'
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="策略"
                name="strategy"
                rules={[{ required: true, message: '請選擇策略' }]}
                initialValue="none"
              >
                <Select placeholder="請選擇策略" className='rounded-sm'>
                  <Select.Option value="none">無</Select.Option>
                  <Select.Option value="波段">波段</Select.Option>
                  <Select.Option value="乖離-2">乖離-2</Select.Option>
                  <Select.Option value="套利1">套利1</Select.Option>
                  <Select.Option value="期現對沖">期現對沖</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          {/* 買進 + 賣出 相關欄位 */}
          <div className="useBetween mt-sm gap-lg">
            <div className="w-full bd-grey-200 px-md pt-base pb-md rounded-md bg-white relative">
              <h4 className="absolute mt-nlg ml-nxs bg-white p-sm text-grey-400">買進</h4>
              <Col gutter={12}>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="買進時間"
                    name="buyTime"
                    className='mb-none'
                  >
                    <DatePicker
                      format="YYYY-MM-DD"
                      placeholder="選擇買進時間"
                      style={{ width: '100%' }}
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="買進價格"
                    name="buyPrice"
                    rules={[
                      { type: 'number', min: 0, message: '買進價格必須大於0' },
                      { validator: validateTradeData }
                    ]}
                    className='mb-none'
                  >
                    <InputNumber
                      placeholder="請輸入買進價格"
                      style={{ width: '100%' }}
                      precision={2}
                      min={0} 
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="買進股數"
                    name="buyQuantity"
                    rules={[
                      { type: 'number', min: 1, message: '買進股數必須大於0' },
                      { validator: validateTradeData }
                    ]}
                    className='mb-none'
                  >
                    <InputNumber
                      placeholder="請輸入買進股數"
                      style={{ width: '100%' }}
                      precision={0}
                      min={1}
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
              </Col>
            </div>

            <div className="w-full bd-grey-200 px-md pt-base pb-md rounded-md bg-white relative">
              <h4 className="absolute mt-nlg ml-nxs bg-white p-sm text-grey-400">賣出</h4>
              <Col gutter={8}>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="賣出時間"
                    name="sellTime"
                    className='mb-none'
                  >
                    <DatePicker
                      format="YYYY-MM-DD"
                      placeholder="選擇賣出時間"
                      style={{ width: '100%' }}
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="賣出價格"
                    name="sellPrice"
                    rules={[
                      { type: 'number', min: 0, message: '賣出價格必須大於0' },
                      { validator: validateTradeData }
                    ]}
                    className='mb-none'
                  >
                    <InputNumber
                      placeholder="請輸入賣出價格"
                      style={{ width: '100%' }}
                      precision={2}
                      min={0}
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
                <Col span={24} className='mt-sm'>
                  <Form.Item
                    label="賣出股數"
                    name="sellQuantity"
                    rules={[
                      { type: 'number', min: 1, message: '賣出股數必須大於0' },
                      { validator: validateTradeData }
                    ]}
                    className='mb-none'
                  >
                    <InputNumber
                      placeholder="請輸入賣出股數"
                      style={{ width: '100%' }}
                      precision={0}
                      min={1}
                      className='rounded-sm'
                    />
                  </Form.Item>
                </Col>
              </Col>
            </div>
            
          </div>

          {/* 試算區域 + 按鈕區域 */}
          <div className="useBetweenEnd mt-sm">
            <div>
              <div className="useBetween mt-md" style={{width: '200px'}}>
                <span className="calculation-label">計算成本</span>
                <span className="calculation-value" style={{ 
                  color: calculations.cost > 0 ? '#1890ff' : '#999'
                }}>
                  {calculations.cost.toFixed(1)} 元
                </span>
              </div>
              <div className="useBetween" style={{width: '200px'}}>
                <span className="calculation-label">停損損失</span>
                <span className="calculation-value" style={{ 
                  color: calculations.stopLossLoss > 0 ? '#ff4d4f' : calculations.stopLossLoss < 0 ? '#52c41a' : '#999'
                }}>
                  {calculations.stopLossLoss.toFixed(1)} 元
                </span>
              </div>
            </div>
            {/* 按鈕區域 */}
            <div className="form-actions">
              <Space>
                <Button onClick={handleCancel}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  新增交易
                </Button>
              </Space>
            </div>
          </div>

        </Form>
      </Modal>
  )
}

export default AddTradeModal