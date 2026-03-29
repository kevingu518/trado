// src/pages/Transactions/components/AddFillModal.jsx
import React from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Option } = Select

const AddFillModal = ({ 
  visible, 
  onClose, 
  onSave, 
  selectedRecord 
}) => {
  const [form] = Form.useForm()

  // 倉位動作選項
  const fillActions = [
    { value: 'buy', label: '買入', color: '#52c41a' },
    { value: 'sell', label: '賣出', color: '#ff4d4f' }
  ]

  // 處理保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const fillData = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        stopLoss: values.stopLoss || null // 停損價可能為空
      }

      onSave(selectedRecord.key, fillData)
      form.resetFields()
      onClose()
      message.success('倉位記錄已添加')
    } catch (error) {
      console.error('保存失敗:', error)
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
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" icon={<PlusOutlined />} onClick={handleSave}>
          新增
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>
            交易標的：{selectedRecord?.stockCode} ({selectedRecord?.direction === 'LONG' ? '多' : '空'})
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            開倉日：{selectedRecord?.openDate} | 狀態：{selectedRecord?.status === 'open' ? '持倉中' : '已完成'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item
            label="日期"
            name="date"
            rules={[{ required: true, message: '請選擇日期' }]}
          >
            <DatePicker 
              placeholder="選擇日期" 
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            label="動作"
            name="action"
            rules={[{ required: true, message: '請選擇動作' }]}
          >
            <Select placeholder="請選擇動作">
              {fillActions.map(action => (
                <Option key={action.value} value={action.value}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        backgroundColor: action.color 
                      }} 
                    />
                    {action.label}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item
            label="價格"
            name="price"
            rules={[
              { required: true, message: '請輸入價格' },
              { type: 'number', min: 0, message: '價格必須大於0' }
            ]}
          >
            <InputNumber 
              placeholder="請輸入價格" 
              style={{ width: '100%' }}
              min={0}
              precision={2}
              addonBefore="$"
            />
          </Form.Item>

          <Form.Item
            label="數量"
            name="quantity"
            rules={[
              { required: true, message: '請輸入數量' },
              { type: 'number', min: 1, message: '數量必須大於0' }
            ]}
          >
            <InputNumber 
              placeholder="請輸入數量" 
              style={{ width: '100%' }}
              min={1}
              precision={0}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item
            label="停損價"
            name="stopLoss"
            rules={[
              { type: 'number', min: 0, message: '停損價必須大於0' }
            ]}
          >
            <InputNumber 
              placeholder="請輸入停損價（選填）" 
              style={{ width: '100%' }}
              min={0}
              precision={2}
              addonBefore="$"
            />
          </Form.Item>

          <Form.Item
            label="備註"
            name="notes"
          >
            <Input placeholder="請輸入備註（選填）" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default AddFillModal
