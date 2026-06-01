import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Tag } from 'antd';
import { CATEGORY_COLORS, pickNextColor } from '../config';

const CategoryFormModal = ({
  visible,
  onClose,
  onSubmit,
  initialData = null,
  existingCategories = [],
  loading = false,
}) => {
  const [form] = Form.useForm();
  const isEdit = !!initialData;

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      form.setFieldsValue({
        name: initialData.name,
        color: initialData.color,
        targetRatioPct:
          initialData.targetRatio === null || initialData.targetRatio === undefined
            ? null
            : Math.round(initialData.targetRatio * 10000) / 100, // 0.42 -> 42
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        color: pickNextColor(existingCategories),
        targetRatioPct: null,
      });
    }
  }, [visible, initialData, existingCategories, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name?.trim(),
        color: values.color,
        targetRatio:
          values.targetRatioPct === null || values.targetRatioPct === undefined || values.targetRatioPct === ''
            ? null
            : Number((values.targetRatioPct / 100).toFixed(4)),
      };
      await onSubmit(payload);
    } catch {
      /* validation error already shown */
    }
  };

  return (
    <Modal
      title={isEdit ? '編輯族群' : '新增族群'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={isEdit ? '儲存' : '建立'}
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="族群名稱"
          name="name"
          rules={[
            { required: true, message: '請輸入族群名稱' },
            { max: 100, message: '最多 100 個字元' },
          ]}
        >
          <Input placeholder="例如：半導體、AI、高股息" autoFocus />
        </Form.Item>

        <Form.Item label="顏色" name="color" rules={[{ required: true, message: '請選擇顏色' }]}>
          <ColorPicker />
        </Form.Item>

        <Form.Item
          label="目標佔比 (%)"
          name="targetRatioPct"
          tooltip="可選。佔總資產（含現金）的目標比例"
          rules={[
            {
              validator: (_, v) => {
                if (v === null || v === undefined || v === '') return Promise.resolve();
                if (v < 0 || v > 100) return Promise.reject(new Error('範圍 0 ~ 100'));
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            step={1}
            precision={2}
            placeholder="未設定"
            style={{ width: 160 }}
            suffix="%"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const ColorPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {CATEGORY_COLORS.map((c) => {
      const selected = value === c;
      return (
        <Tag.CheckableTag
          key={c}
          checked={selected}
          onChange={() => onChange?.(c)}
          style={{
            padding: 0,
            border: selected ? '2px solid #1677ff' : '2px solid transparent',
            borderRadius: 6,
            background: 'transparent',
          }}
        >
          <Tag color={c} style={{ margin: 0, minWidth: 56, textAlign: 'center' }}>
            {c}
          </Tag>
        </Tag.CheckableTag>
      );
    })}
  </div>
);

export default CategoryFormModal;
