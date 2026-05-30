import React, { useState, useEffect } from 'react'
import { Drawer, Descriptions, Tag, Button, Space, Popconfirm, Row, Col, Tabs, Form, Input, InputNumber, Select, Table, Empty, Spin, theme } from 'antd'
import { EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import PerfectScrollbar from 'react-perfect-scrollbar'
import 'react-perfect-scrollbar/dist/css/styles.css'
import { useTrades } from '@/features/trades/hooks/useTrades'

const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

// 策略表單區塊顏色配置
const SECTION_COLORS = {
  basic: '#e6f7ff',      // 基本資訊 - 淡藍色
  trading: '#f0f5ff',    // 交易條件 - 更淡的藍色
  risk: '#fff7e6',       // 風險管理 - 淡橙色/米色
  other: '#f5f5f5',      // 其他 - 淡灰色（柔和，不螢光）
}

const StrategyDrawer = ({
  visible,
  onClose,
  strategyData,
  onEdit,
  onDelete,
  loading = false,
}) => {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('performance')
  const { token } = theme.useToken()

  // 獲取該策略的交易記錄（使用 strategyId）
  const { 
    data: tradesData, 
    loading: tradesLoading 
  } = useTrades({
    strategy: strategyData?.id,
    page: 1,
    pageSize: 20,
  }, !!strategyData?.id && visible)

  useEffect(() => {
    if (visible && strategyData) {
      form.setFieldsValue({
        name: strategyData.name,
        description: strategyData.description,
        category: strategyData.category || strategyData.type,
        stockSelectionCriteria: strategyData.stockSelectionCriteria,
        entryConditions: strategyData.entryConditions,
        exitConditions: strategyData.exitConditions,
        riskManagement: strategyData.riskManagement,
        maxDrawdownTolerance: strategyData.maxDrawdownTolerance,
        expectedWinRate: strategyData.expectedWinRate,
        expectedProfitLossRatio: strategyData.expectedProfitLossRatio,
        note: strategyData.note,
      })
    }
  }, [visible, strategyData, form])

  if (!strategyData) return null

  const categoryMap = {
    'TREND_FOLLOWING': '趨勢跟隨',
    'CONTRARIAN': '逆勢策略',
    'DAY_TRADING': '當沖交易',
    'DIVIDEND_INVESTING': '股息投資',
    'trend': '趨勢策略',
    'mean-reversion': '均值回歸',
    'arbitrage': '套利策略',
    'momentum': '動量策略',
    'other': '其他',
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(strategyData.id)
    }
  }

  // 交易記錄表格欄位
  const tradeColumns = [
    {
      title: '股號',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      render: (direction) => (
        <Tag color={direction === 'long' ? 'green' : 'red'}>
          {direction === 'long' ? '多' : '空'}
        </Tag>
      ),
    },
    {
      title: '開倉日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '清倉日',
      dataIndex: 'closedAt',
      key: 'closedAt',
      width: 120,
      render: (closedAt) => closedAt || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '盈虧',
      dataIndex: 'profitLoss',
      key: 'profitLoss',
      width: 120,
      render: (profitLoss) => {
        if (profitLoss === null || profitLoss === undefined) return '-'
        const isProfit = profitLoss > 0
        return (
          <span style={{ color: isProfit ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
            {isProfit ? '+' : ''}{profitLoss.toLocaleString()}
          </span>
        )
      },
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'open' ? 'orange' : 'default'}>
          {status === 'open' ? '持倉中' : '已清倉'}
        </Tag>
      ),
    },
  ]

  const tradesList = tradesData?.list || []

  return (
    <Drawer
      title="策略詳情"
      placement="right"
      onClose={onClose}
      open={visible}
      width="100%"
      getContainer={false}
      maskClosable={true}
      closable={true}
      className="StrategyDrawer"
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
      extra={
        strategyData.isSystem ? null : (
          <Space>
            <Popconfirm
              title="刪除策略"
              description="將刪除此策略及其所有相關記錄，此操作無法復原，確定要刪除嗎？"
              okText="刪除"
              okType="danger"
              cancelText="取消"
              onConfirm={handleDelete}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                className="StrategyDrawer-delete-btn"
              >
                刪除
              </Button>
            </Popconfirm>

            <Button
              icon={<EditOutlined />}
              onClick={() => onEdit && onEdit(strategyData)}
              style={{ borderRadius: '4px' }}
            >
              編輯
            </Button>
          </Space>
        )
      }
    >
      <Row gutter={0} style={{ height: '100%' }}>
        {/* 左半部：策略表單 */}
        <Col span={12} style={{ borderRight: '1px solid #f0f0f0' }}>
          <PerfectScrollbar className="pb-xl" style={{ height: 'calc(100vh - 64px)' }}>
            <div style={{ padding: '8px 12px' }}>
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
                        >
                          <Input 
                            placeholder="請輸入策略名稱" 
                            style={{ borderRadius: '4px' }}
                            readOnly
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="策略分類"
                          name="category"
                        >
                          <Select 
                            placeholder="請選擇策略分類"
                            style={{ borderRadius: '4px' }}
                            disabled
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
                        readOnly
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
                        readOnly
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
                            readOnly
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
                            readOnly
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
                        readOnly
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
                            disabled
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
                            disabled
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
                            disabled
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                </div>

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
                        readOnly
                      />
                    </Form.Item>
                  </div>
                </div>
              </Form>
            </div>
          </PerfectScrollbar>
        </Col>

        {/* 右半部：Tabs */}
        <Col span={12}>
          <PerfectScrollbar style={{ height: 'calc(100vh - 64px)' }}>
            <div style={{ padding: '8px 12px' }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: 'performance',
                    label: '績效',
                    children: (
                      <div className="strategy-performance">
                        <Descriptions 
                          bordered 
                          column={2}
                          size="middle"
                          className="performance-descriptions"
                          labelStyle={{ 
                            fontWeight: 500,
                            width: '140px',
                            background: '#fafafa'
                          }}
                          contentStyle={{ 
                            background: '#fff'
                          }}
                        >
                          {/* 第一行：總盈虧、勝率 */}
                          <Descriptions.Item label="總盈虧">
                            <span style={{ 
                              color: (strategyData.stats?.totalProfitLoss ?? 0) >= 0
                                ? token.colorError 
                                : token.colorSuccess,
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              {strategyData.stats?.totalProfitLoss !== null && strategyData.stats?.totalProfitLoss !== undefined
                                ? strategyData.stats.totalProfitLoss.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 })
                                : '$0'}
                            </span>
                          </Descriptions.Item>
                          
                          <Descriptions.Item label="勝率">
                            {strategyData.stats?.winRate !== null && strategyData.stats?.winRate !== undefined
                              ? `${strategyData.stats.winRate.toFixed(2)}%`
                              : '0%'}
                          </Descriptions.Item>
                          
                          {/* 第二行：總交易數、獲利交易數、虧損交易數（合併成一格） */}
                          <Descriptions.Item label="交易統計" span={2}>
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '12px', color: '#8c8c8c', marginRight: '8px' }}>總交易數：</span>
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{strategyData.stats?.totalTrades ?? 0}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '12px', color: '#8c8c8c', marginRight: '8px' }}>獲利：</span>
                                <span style={{ color: token.colorError, fontWeight: 500 }}>
                                  {strategyData.stats?.winningTrades ?? 0}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontSize: '12px', color: '#8c8c8c', marginRight: '8px' }}>虧損：</span>
                                <span style={{ color: token.colorSuccess, fontWeight: 500 }}>
                                  {strategyData.stats?.losingTrades ?? 0}
                                </span>
                              </div>
                            </div>
                          </Descriptions.Item>
                          
                          {/* 第三行：最大回撤、平均持倉時間 */}
                          <Descriptions.Item label="最大回撤">
                            <span style={{ color: '#fa8c16', fontWeight: 500 }}>
                              {strategyData.stats?.maxDrawdown !== null && strategyData.stats?.maxDrawdown !== undefined
                                ? `${strategyData.stats.maxDrawdown.toFixed(2)}%`
                                : '-'}
                            </span>
                          </Descriptions.Item>
                          
                          <Descriptions.Item label="平均持倉時間">
                            {strategyData.stats?.avgHoldingDuration !== null && strategyData.stats?.avgHoldingDuration !== undefined
                              ? `${strategyData.stats.avgHoldingDuration.toFixed(1)} 天`
                              : '-'}
                          </Descriptions.Item>
                        </Descriptions>
                      </div>
                    ),
                  },
                  {
                    key: 'trades',
                    label: '交易紀錄',
                    children: (
                      <div>
                        {tradesLoading ? (
                          <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Spin size="large" />
                          </div>
                        ) : tradesList.length === 0 ? (
                          <Empty description="尚無交易紀錄" />
                        ) : (
                          <Table
                            columns={tradeColumns}
                            dataSource={tradesList}
                            rowKey="id"
                            pagination={false}
                            size="small"
                          />
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </PerfectScrollbar>
        </Col>
      </Row>
    </Drawer>
  )
}

export default StrategyDrawer
