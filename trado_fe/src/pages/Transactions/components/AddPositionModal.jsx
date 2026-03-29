// src/pages/Transactions/components/AddPositionModal.jsx
import React from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, message, Segmented } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Option } = Select

const AddPositionModal = ({ 
  visible, 
  onClose, 
  onSave 
}) => {
  const [form] = Form.useForm()

  // 策略選項
  const strategies = [
    { value: 'none', label: '無' },
    { value: '波段', label: '波段' },
    { value: '乖離-2', label: '乖離-2' },
    { value: '套利1', label: '套利1' },
    { value: '期現對沖', label: '期現對沖' }
  ]

  // 處理保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const positionData = {
        ...values,
        openDate: values.openDate.format('YYYY-MM-DD'),
        key: Date.now().toString(), // 生成唯一 key
        fills: [], // 初始為空
        review: {
          content: '',
          errorCategory: '',
          selfRating: 0,
          emotion: ''
        }
      }

      onSave(positionData)
      form.resetFields()
      onClose()
      message.success('交易記錄已新增')
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
      title="新增交易記錄"
      open={visible}
      onCancel={handleCancel}
      width={600}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <Form.Item
            label="股號"
            name="stockCode"
            rules={[
              { required: true, message: '請輸入股號' },
              { pattern: /^[0-9]{4}$/, message: '股號必須為4位數字' }
            ]}
          >
            <Input placeholder="請輸入4位數字股號" maxLength={4} />
          </Form.Item>

          <Form.Item
            label="多空"
            name="direction"
            rules={[{ required: true, message: '請選擇多空' }]}
            initialValue="LONG"
          >
            <Segmented
              options={[
                { label: '多', value: 'LONG' },
                { label: '空', value: 'SHORT' }
              ]}
              block
            />
          </Form.Item>

          <Form.Item
            label="策略"
            name="strategy"
            rules={[{ required: true, message: '請選擇策略' }]}
            initialValue="none"
          >
            <Select placeholder="請選擇策略">
              {strategies.map(strategy => (
                <Option key={strategy.value} value={strategy.value}>
                  {strategy.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item
            label="開倉日"
            name="openDate"
            rules={[{ required: true, message: '請選擇開倉日' }]}
          >
            <DatePicker 
              placeholder="選擇開倉日" 
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            label="清倉日"
            name="closeDate"
          >
            <DatePicker 
              placeholder="選擇清倉日（選填）" 
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>
        </div>

        <Form.Item
          label="備註"
          name="notes"
        >
          <Input.TextArea 
            placeholder="請輸入備註（選填）"
            rows={3}
            maxLength={200}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddPositionModal
