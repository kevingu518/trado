import { useEffect } from 'react';
import { Form, InputNumber, Button, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTradeSettings } from '../hooks/useAccount';

const FeeSettings = () => {
  const { settings, loading, updateSettings } = useTradeSettings();
  const [form] = Form.useForm();

  // 初始化表單值
  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        buyFeeRate: settings.buyFeeRate * 100, // 轉換為百分比顯示
        sellFeeRate: settings.sellFeeRate * 100,
        minFee: settings.minFee,
      });
    }
  }, [settings, form]);

  // 處理表單提交
  const handleSubmit = async (values) => {
    try {
      await updateSettings({
        buyFeeRate: values.buyFeeRate / 100, // 轉換回小數
        sellFeeRate: values.sellFeeRate / 100,
        minFee: values.minFee,
      });
    } catch (error) {
      console.error('更新交易設定失敗:', error);
    }
  };

  return (
    <div>
      <div className='flex items-center gap-sm mb-md'>
        <Tooltip
          title="手續費計算公式：交易金額 × 手續費率，最低收取設定的最低手續費。此設定將用於所有交易記錄的盈虧計算。"
          placement="right"
        >
          <span className='text-grey-500 mr-sm gap-sm'>手續費設定</span>
          <InfoCircleOutlined className='text-grey-500' style={{ cursor: 'help' }} />
        </Tooltip>
      </div>

      <Form
        form={form}
        layout="horizontal"
        className='column'
        onFinish={handleSubmit}
      >
        <Form.Item
          label="買入手續費率"
          name="buyFeeRate"
          className='mb-sm'
          rules={[
            { required: true, message: '請輸入買入手續費率' },
            { type: 'number', min: 0, max: 1, message: '手續費率必須在 0% 到 1% 之間' },
          ]}
          tooltip="例如：0.1425 表示 0.1425%（台股一般手續費）"
        >
          <InputNumber
            className="rounded-sm"
            placeholder="請輸入買入手續費率（%）"
            min={0}
            max={1}
            step={0.0001}
            precision={4}
            style={{ borderRadius: '0px' }}
            formatter={(value) => {
              if (!value) return '';
              const num = parseFloat(value);
              return `${num.toFixed(4)}%`;
            }}
            parser={(value) => value.replace('%', '')}
            addonAfter="%"
          />
        </Form.Item>

        <Form.Item
          label="賣出手續費率"
          name="sellFeeRate"
          className='mb-sm'
          rules={[
            { required: true, message: '請輸入賣出手續費率' },
            { type: 'number', min: 0, max: 1, message: '手續費率必須在 0% 到 1% 之間' },
          ]}
          tooltip="例如：0.1425 表示 0.1425%（台股一般手續費）"
        >
          <InputNumber
            className="rounded-sm"
            placeholder="請輸入賣出手續費率（%）"
            min={0}
            max={1}
            step={0.0001}
            precision={4}
            formatter={(value) => {
              if (!value) return '';
              const num = parseFloat(value);
              return `${num.toFixed(4)}%`;
            }}
            parser={(value) => value.replace('%', '')}
            addonAfter="%"
          />
        </Form.Item>

        <Form.Item
          label="最低手續費"
          name="minFee"
          className='mb-md'
          rules={[
            { required: true, message: '請輸入最低手續費' },
            { type: 'number', min: 0, max: 100, message: '最低手續費必須在 0 到 100 元之間' },
          ]}
          tooltip="當計算出的手續費低於此金額時，將收取此最低手續費"
        >
          <InputNumber
            className="rounded-sm"
            placeholder="請輸入最低手續費（元）"
            min={0}
            max={100}
            step={1}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
            addonAfter="元"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} className="rounded-sm">
            儲存設定
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default FeeSettings;
