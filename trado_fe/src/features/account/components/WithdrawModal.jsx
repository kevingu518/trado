import React from 'react';
import { Modal, Form, InputNumber, DatePicker, Input, message } from 'antd';
import dayjs from 'dayjs';

const WithdrawModal = ({ open, onCancel, onOk, loading, availableBalance }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 檢查餘額是否足夠
      if (values.amount > availableBalance) {
        message.error('出金金額不能超過可用餘額');
        return;
      }

      await onOk({
        amount: values.amount,
        date: values.date.format('YYYY-MM-DD'),
        method: values.method || '',
        notes: values.notes || '',
      });
      form.resetFields();
    } catch (error) {
      if (error.errorFields) {
        // 表單驗證錯誤
        return;
      }
      console.error('出金失敗:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="出金"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="確認出金"
      cancelText="取消"
    >
      <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <div style={{ fontSize: 14, color: '#666' }}>可用餘額</div>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
          NT$ {availableBalance.toLocaleString()}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          date: dayjs(),
        }}
      >
        <Form.Item
          label="出金金額"
          name="amount"
          rules={[
            { required: true, message: '請輸入出金金額' },
            { type: 'number', min: 1, message: '金額必須大於 0' },
            {
              validator: (_, value) => {
                if (value && value > availableBalance) {
                  return Promise.reject(new Error('出金金額不能超過可用餘額'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="請輸入出金金額"
            min={1}
            max={availableBalance}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
            prefix="NT$"
          />
        </Form.Item>

        <Form.Item
          label="日期"
          name="date"
          rules={[{ required: true, message: '請選擇日期' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            disabledDate={(current) => current && current > dayjs().endOf('day')}
          />
        </Form.Item>

        <Form.Item
          label="出金方式"
          name="method"
        >
          <Input placeholder="例如：銀行轉帳、現金等（選填）" />
        </Form.Item>

        <Form.Item
          label="備註"
          name="notes"
        >
          <Input.TextArea
            rows={3}
            placeholder="備註（選填）"
            maxLength={200}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WithdrawModal;
