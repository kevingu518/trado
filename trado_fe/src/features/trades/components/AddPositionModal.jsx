// src/features/trades/components/AddPositionModal.jsx
import React, { useEffect } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Button, Space, message, Segmented } from 'antd'
import dayjs from 'dayjs'
import { PlusOutlined } from '@ant-design/icons'
import '../styles/AddPositionModal.scss'

const AddPositionModal = ({ 
  visible, 
  onClose, 
  onSave, 
  selectedRecord 
}) => {
  const [form] = Form.useForm()

  useEffect(() => {
    if (visible) {
      form.resetFields()
      form.setFieldsValue({
        date: dayjs(),
        action: selectedRecord?.direction === 'short' ? 'sell' : 'buy',
      })
    }
  }, [visible, form, selectedRecord])

  // 處理保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const positionData = {
        action: values.action,
        shares: values.shares,
        price: values.price,
        date: values.date, // 保持 dayjs 物件，DTO 會處理轉換
        stopLoss: values.stopLoss || null, // 停損價可能為空
        note: values.note || null, // 備註可能為空
      }

      // 確保 selectedRecord 存在且有 id
      if (!selectedRecord) {
        message.error('交易記錄不存在，請重新選擇')
        return
      }

      const tradeId = selectedRecord.id || selectedRecord.key
      if (!tradeId) {
        message.error('交易 ID 不存在')
        return
      }

      await onSave(tradeId, positionData)
      form.resetFields()
      onClose()
    } catch (error) {
      console.error('保存失敗:', error)
      // 錯誤訊息由父組件處理
    }
  }

  // 處理取消
  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="新增倉位變動"
      open={visible}
      onCancel={handleCancel}
      className='AddPositionModal'
      width={640}
      footer={[
        <Button key="cancel" onClick={handleCancel} size="large" style={{ borderRadius: '4px' }}>
          取消
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleSave}
          size="large"
          style={{ borderRadius: '4px' }}
        >
          新增
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>
            交易標的：{selectedRecord?.symbol} ({selectedRecord?.direction === 'long' ? '多' : '空'})
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            開倉日：{selectedRecord?.createdAt} | 狀態：{selectedRecord?.status === 'open' ? '持倉中' : '已完成'}
          </div>
        </div>

        <div className='useBetween gap-md'>
          <Form.Item
            label="日期"
            name="date"
            className='flex-1'
            rules={[{ required: true, message: '請選擇日期' }]}
          >
            <DatePicker 
              placeholder="選擇日期" 
              style={{ width: '100%', borderRadius: '4px' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            label="動作"
            name="action"
            className='flex-1'
            rules={[{ required: true, message: '請選擇動作' }]}
          >
            <Segmented
              options={[
                { label: '買入', value: 'buy' },
                { label: '賣出', value: 'sell' }
              ]}
              block
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>
        </div>

        <div className='useBetween gap-md'>
          <Form.Item
            label="價格"
            name="price"
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
            name="shares"
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
            name="stopLoss"
            className='flex-1'
            rules={[
              { type: 'number', min: 0, message: '停損價必須大於0' }
            ]}
          >
            <InputNumber 
              placeholder="請輸入停損價（選填）" 
              style={{ width: '100%', borderRadius: '4px' }}
              min={0}
              precision={2}
              addonBefore="$"
            />
          </Form.Item>

          <Form.Item
            label="備註"
            name="note"
            className='flex-1'
          >
            <Input 
              placeholder="請輸入備註（選填）" 
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default AddPositionModal
