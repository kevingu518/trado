import React from 'react';
import { Modal, Form, InputNumber, DatePicker, Input, message } from 'antd';
import dayjs from 'dayjs';

const DepositModal = ({ open, onCancel, onOk, loading }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
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
      console.error('入金失敗:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="入金"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="確認入金"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          date: dayjs(),
        }}
      >
        <Form.Item
          label="入金金額"
          name="amount"
          rules={[
            { required: true, message: '請輸入入金金額' },
            { type: 'number', min: 1, message: '金額必須大於 0' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="請輸入入金金額"
            min={1}
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
          label="入金方式"
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

export default DepositModal;
