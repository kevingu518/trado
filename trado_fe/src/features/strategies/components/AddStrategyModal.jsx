import React, { useEffect } from 'react'
import { Drawer, Form, Input, Select, Switch, Button, InputNumber, Row, Col, Space } from 'antd'
import PerfectScrollbar from 'react-perfect-scrollbar'
import 'react-perfect-scrollbar/dist/css/styles.css'
import { useTheme } from '@/contexts/ThemeContext'

const { Option } = Select
const { TextArea } = Input

// 策略表單區塊顏色配置
const SECTION_COLORS = {
  basic: '#e6f7ff',      // 基本資訊 - 淡藍色
  trading: '#f0f5ff',    // 交易條件 - 更淡的藍色
  risk: '#fff7e6',       // 風險管理 - 淡橙色/米色
  other: '#f5f5f5',      // 其他 - 淡灰色（柔和，不螢光）
}

const AddStrategyDrawer = ({ 
  visible, 
  onClose, 
  onSubmit, 
  initialData = null,
  loading = false 
}) => {
  const [form] = Form.useForm()
  const [isActive, setIsActive] = React.useState(true)
  const isEditMode = !!initialData
  const { theme, currentTheme } = useTheme()
  
  // 獲取錯誤提示的紅色：如果主題是紅色，使用主題的 primary，否則使用固定的錯誤色
  const errorColor = currentTheme === 'red' ? theme.primary : '#ff4d4f'
  
  // 計算錯誤色的陰影（用於 focus 狀態）
  const hexToRgba = (hex, alpha = 0.2) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const errorColorShadow = hexToRgba(errorColor, 0.2)

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setIsActive(initialData.isActive !== undefined ? initialData.isActive : true)
        form.setFieldsValue({
          name: initialData.name,
          description: initialData.description,
          category: initialData.category || initialData.type,
          stockSelectionCriteria: initialData.stockSelectionCriteria,
          entryConditions: initialData.entryConditions,
          exitConditions: initialData.exitConditions,
          riskManagement: initialData.riskManagement,
          maxDrawdownTolerance: initialData.maxDrawdownTolerance,
          expectedWinRate: initialData.expectedWinRate,
          expectedProfitLossRatio: initialData.expectedProfitLossRatio,
          watchlistTrigger: initialData.watchlistTrigger,
          addPositionRules: initialData.addPositionRules,
          note: initialData.note,
        })
      } else {
        setIsActive(true)
        form.resetFields()
        form.setFieldsValue({
          category: 'TREND_FOLLOWING',
        })
      }
    }
  }, [visible, initialData, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      // 將 isActive 狀態加入到提交的資料中
      onSubmit({ ...values, isActive })
    } catch (error) {
      console.error('表單驗證失敗:', error)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Drawer
      title={isEditMode ? '編輯策略' : '新增策略'}
      placement="right"
      onClose={handleCancel}
      open={visible}
      width={800}
      getContainer={false}
      maskClosable={true}
      closable={true}
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
      extra={
        <Space>
          <span style={{ marginRight: 8, fontSize: '12px' }}>啟用狀態：</span>
          <Switch 
            checked={isActive} 
            onChange={setIsActive}
            size="small"
            style={{ marginRight: 16 }}
          />
          <Button onClick={handleCancel} style={{ borderRadius: '4px' }}>
            取消
          </Button>
          <Button 
            type="primary" 
            onClick={handleSubmit}
            loading={loading}
            style={{ borderRadius: '4px' }}
          >
            {isEditMode ? '保存' : '新增'}
          </Button>
        </Space>
      }
    >
      <PerfectScrollbar className="full-width">
        <div 
          style={{ 
            ['--strategy-error-color']: errorColor,
            ['--strategy-error-color-shadow']: errorColorShadow
          }}
        >
          <Form
            form={form}
            layout="vertical"
            className="add-strategy-form"
          >
        {/* 基本資訊 */}
        <div 
          className='bg-white pr-md pb-xs'
          style={{ 
            borderTopLeftRadius: '4px',
            borderLeft: `3px solid ${SECTION_COLORS.basic}`,
          }}
        >
          <div
            className='text-md py-xs pl-base pr-base mb-base fw-600'
            style={{ color: '#595959', backgroundColor: SECTION_COLORS.basic, display: 'inline-block', borderRadius: '0px 4px 4px 0px' }}>
            基本資訊
          </div>
          <div className='ml-md'>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="策略名稱"
                  name="name"
                  rules={[{ required: true, message: '請輸入策略名稱' }]}
                >
                  <Input 
                    placeholder="請輸入策略名稱" 
                    style={{ borderRadius: '4px' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="策略分類"
                  name="category"
                  rules={[{ required: true, message: '請選擇策略分類' }]}
                  initialValue="TREND_FOLLOWING"
                >
                  <Select 
                    placeholder="請選擇策略分類"
                    style={{ borderRadius: '4px' }}
                  >
                    <Option value="TREND_FOLLOWING">趨勢跟隨</Option>
                    <Option value="CONTRARIAN">逆勢策略</Option>
                    <Option value="DAY_TRADING">當沖交易</Option>
                    <Option value="DIVIDEND_INVESTING">股息投資</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="策略描述"
              name="description"
            >
              <TextArea
                rows={3}
                placeholder="請輸入策略描述（選填）"
                style={{ borderRadius: '4px' }}
              />
            </Form.Item>
          </div>
        </div>

        {/* 交易條件 */}
        <div 
          className='bg-white pr-md pb-xs' 
          style={{borderLeft: `3px solid ${SECTION_COLORS.trading}`}}
        >
          <div
            className='text-md py-xs pl-base pr-base mb-base fw-600'
            style={{ color: '#595959', backgroundColor: SECTION_COLORS.trading, display: 'inline-block', borderRadius: '0px 4px 4px 0px' }}>
            交易條件
          </div>
          <div className='ml-md'>
            <Form.Item
            label="選股條件"
            name="stockSelectionCriteria"
          >
            <TextArea
              rows={3}
              placeholder="例如：市值 > 100億, 本益比 < 20（選填）"
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="進場條件"
                name="entryConditions"
              >
                <TextArea
                  rows={3}
                  placeholder="例如：突破前高 + 成交量放大（選填）"
                  style={{ borderRadius: '4px' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="出場條件"
                name="exitConditions"
              >
                <TextArea
                  rows={3}
                  placeholder="例如：跌破支撐線或達到目標價（選填）"
                  style={{ borderRadius: '4px' }}
                />
              </Form.Item>
              </Col>
            </Row>
          </div>
        </div>

        {/* 風險管理 */}
        <div 
          className='bg-white pr-md pb-xs' 
          style={{borderLeft: `3px solid ${SECTION_COLORS.risk}` }}
        >
          <div
            className='text-md py-xs pl-base pr-base mb-base fw-600'
            style={{ color: '#595959', backgroundColor: SECTION_COLORS.risk, display: 'inline-block', borderRadius: '0px 4px 4px 0px' }}>
            風險管理
          </div>
          <div className='ml-md'>
            <Form.Item
              label="風險管理"
              name="riskManagement"
            >
              <TextArea
                rows={2}
                placeholder="例如：單筆交易不超過總資金 5%（選填）"
                style={{ borderRadius: '4px' }}
              />
            </Form.Item>
          </div>

          {/* 風險參數 */}
          <div className='ml-md'>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="最大回撤容忍度 (%)"
                  name="maxDrawdownTolerance"
                >
                  <InputNumber
                    placeholder="例如：15.50"
                    style={{ width: '100%', borderRadius: '4px' }}
                    min={0}
                    max={100}
                    precision={2}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="預期勝率 (%)"
                  name="expectedWinRate"
                >
                  <InputNumber
                    placeholder="例如：65.50"
                    style={{ width: '100%', borderRadius: '4px' }}
                    min={0}
                    max={100}
                    precision={2}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="預期盈虧比"
                  name="expectedProfitLossRatio"
                >
                  <InputNumber
                    placeholder="例如：2.50"
                    style={{ width: '100%', borderRadius: '4px' }}
                    min={0}
                    precision={2}
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </div>

        {/* 觸發條件與加碼規則 - 暫時隱藏 */}
        {/* <Form.Item
          label="觀察清單觸發條件"
          name="watchlistTrigger"
        >
          <TextArea
            rows={2}
            placeholder="例如：RSI < 30 且 MACD 金叉（選填）"
            style={{ borderRadius: '4px' }}
          />
        </Form.Item>

        <Form.Item
          label="加碼規則"
          name="addPositionRules"
        >
          <TextArea
            rows={2}
            placeholder="例如：獲利 10% 後可加碼 50%（選填）"
            style={{ borderRadius: '4px' }}
          />
        </Form.Item> */}

        {/* 其他 */}
        <div 
          className='bg-white pr-md pb-xs' 
          style={{ 
            borderBottomLeftRadius: '4px',
            borderLeft: `3px solid ${SECTION_COLORS.other}`,
          }}
        >
          <div
            className='text-md py-xs pl-base pr-base mb-base fw-600'
            style={{ color: '#595959', backgroundColor: SECTION_COLORS.other, display: 'inline-block', borderRadius: '0px 4px 4px 0px' }}>
            其他
          </div>
          <div className='ml-md'>
            <Form.Item
              label="策略備註"
              name="note"
            >
              <TextArea
                rows={2}
                placeholder="請輸入策略備註（選填）"
                style={{ borderRadius: '4px' }}
              />
            </Form.Item>
          </div>
        </div>
      </Form>
        </div>
      </PerfectScrollbar>
    </Drawer>
  )
}

export default AddStrategyDrawer
