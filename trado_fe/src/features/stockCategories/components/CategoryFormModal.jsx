import React from 'react';
import { Modal, Form, Input } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { pickNextColor } from '../config';
import { useThemePalette } from '../hooks/useThemePalette';

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

  // 在 modal 完全打開後填入初始值（避免 mount 時機問題）
  const handleAfterOpenChange = (open) => {
    if (!open) return;
    if (initialData) {
      form.setFieldsValue({
        name: initialData.name,
        color: initialData.color,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        color: pickNextColor(existingCategories),
      });
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name?.trim(),
        color: values.color,
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
      afterOpenChange={handleAfterOpenChange}
      confirmLoading={loading}
      okText={isEdit ? '儲存' : '建立'}
      cancelText="取消"
      forceRender
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="族群名稱"
          name="name"
          rules={[
            { required: true, message: '請輸入族群名稱' },
            { max: 100, message: '最多 100 個字元' },
          ]}
        >
          <Input
            placeholder="例如：半導體、AI、高股息"
            autoFocus
            style={{ borderRadius: 4 }}
          />
        </Form.Item>

        <Form.Item label="顏色" name="color" rules={[{ required: true, message: '請選擇顏色' }]}>
          <ColorPicker />
        </Form.Item>

        <div style={{ color: '#999', fontSize: 12, marginTop: -8 }}>
          目標佔比請在列表中直接點數字編輯。
        </div>
      </Form>
    </Modal>
  );
};

const ColorPicker = ({ value, onChange }) => {
  const { names, palette } = useThemePalette();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {names.map((name) => {
        const hex = palette[name];
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange?.(name)}
            aria-label={name}
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              background: hex,
              border: selected ? '2px solid #1677ff' : '2px solid #fff',
              outline: selected ? 'none' : '1px solid #e0e0e0',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.2)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {selected && <CheckOutlined style={{ fontSize: 14 }} />}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFormModal;
