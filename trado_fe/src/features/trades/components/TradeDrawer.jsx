// src/features/trades/components/TradeDrawer.jsx
import React, { useState, useEffect } from 'react'
import { 
  Drawer, Row, Col, Card, Form, Input, Select, Rate,
  Button, Space, Table, Tag, message, InputNumber, DatePicker, Popconfirm, Typography, Spin, Switch
} from 'antd'
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useTrade } from '../hooks/useTrade'
import KLineChart from './KLineChart'

const { TextArea } = Input
const { Option } = Select

import advancedFormat from 'dayjs/plugin/advancedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import localeData from 'dayjs/plugin/localeData'
import weekday from 'dayjs/plugin/weekday'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import weekYear from 'dayjs/plugin/weekYear'

dayjs.extend(customParseFormat)
dayjs.extend(advancedFormat)
dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.extend(weekOfYear)
dayjs.extend(weekYear)

const EditableCell = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
  children,
  ...restProps
}) => {
  const inputNode = inputType === 'number' 
    ? <InputNumber /> 
    : inputType === 'select' 
      ? (<Select>
          <Option value="buy">買入</Option>
          <Option value="sell">賣出</Option>
        </Select>) 
      : inputType === 'date' 
        ? <DatePicker format="YYYY-MM-DD" /> 
        : <Input />;
  
  // 停損價和備註是非必填欄位
  const isOptional = dataIndex === 'stopLoss' || dataIndex === 'note'
  
  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={
            isOptional
              ? [] // 非必填欄位不需要驗證規則
              : [
                  {
                    required: true,
                    message: `請輸入 ${title}!`,
                  },
                ]
          }
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

const TradeDrawer = ({ 
  visible, 
  onClose, 
  tradeId, 
  onSaveReview, 
  onAddPosition, 
  onEditPosition, 
  onDeletePosition,
  onPositionAddedRef, // 用於存儲刷新函數的 ref
  onDeleteTrade,      // 刪除整筆交易的 callback
}) => {
  // ------------------ hooks ------------------
  const root = getComputedStyle(document.documentElement)
  const CLR_UP = root.getPropertyValue('--color-up').trim()
  const CLR_DOWN = root.getPropertyValue('--color-down').trim()
  const CLR_NONE = '#666'
  const pnlColor = (v) => v > 0 ? CLR_UP : v < 0 ? CLR_DOWN : CLR_NONE

  // 監聽 viewport：寬螢幕 (>=1280) 切左右分欄、K 線填滿左欄高度；窄螢幕保持上下擺
  const [viewport, setViewport] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
    vh: typeof window !== 'undefined' ? window.innerHeight : 900,
  }))
  useEffect(() => {
    const handler = () => setViewport({ vw: window.innerWidth, vh: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const isWideLayout = viewport.vw >= 1280
  const drawerWidth = isWideLayout ? Math.min(viewport.vw * 0.9, 1320) : 1000
  // K 線高度綁寬度（≈ 3:2 含成交量副圖），避免綁 viewport.vh 造成主圖被撐成正方形、趨勢失真
  // K 線右欄寬 = (drawer 內容寬 - drawer padding 32 - gap 16) × 60% - card body padding 24
  const chartPaneInnerWidth = isWideLayout ? (drawerWidth - 32 - 16) * 0.60 - 24 : 0
  const wideChartHeight = Math.max(Math.round(chartPaneInnerWidth / 1.5), 380)

  // 使用 useTrade hook 獲取交易詳情
  const { data: tradeData, loading: tradeLoading, error: tradeError, refetch: refetchTrade } = useTrade(tradeId, visible)
  
  // 將 refetchTrade 函數存儲到 ref 中，讓父組件可以調用
  React.useEffect(() => {
    if (onPositionAddedRef) {
      onPositionAddedRef.current = refetchTrade
    }
    return () => {
      if (onPositionAddedRef) {
        onPositionAddedRef.current = null
      }
    }
  }, [refetchTrade, onPositionAddedRef])

  // ------------------ variables ------------------
  const [reviewForm] = Form.useForm() // 檢討表單
  const [form] = Form.useForm(); // 倉位表格表單
  const [editingKey, setEditingKey] = useState('');
  const isEditing = record => record.key === editingKey;

  // 從 tradeData 取得倉位調整資料
  const positionAdjustments = tradeData?.positionAdjustments || []

  // ------------------ configs ------------------
  // 錯誤分類選項（對應後端 ErrorCategory enum）
  const errorCategories = [
    { value: 'ENTRY_TIMING', label: '進場時機錯誤' },
    { value: 'EXIT_TIMING', label: '出場時機錯誤' },
    { value: 'POSITION_SIZE', label: '部位大小錯誤' },
    { value: 'EMOTION_CONTROL', label: '情緒控制問題' },
    { value: 'STRATEGY_DEVIATION', label: '偏離策略' },
    { value: 'RISK_MANAGEMENT', label: '風險管理不當' },
    { value: 'MARKET_ANALYSIS', label: '市場分析錯誤' },
    { value: 'OTHER', label: '其他' }
  ]

  // 情緒選項（對應後端 Emotion enum）
  const emotions = [
    { value: 'CALM', label: '冷靜', color: '#1890ff' },
    { value: 'ANXIOUS', label: '焦慮', color: '#faad14' },
    { value: 'EXCITED', label: '興奮', color: '#eb2f96' },
    { value: 'FEARFUL', label: '恐懼', color: CLR_DOWN },
    { value: 'GREEDY', label: '貪婪', color: '#ff7a45' },
    { value: 'CONFIDENT', label: '自信', color: CLR_UP },
    { value: 'DOUBTFUL', label: '懷疑', color: '#fa8c16' },
    { value: 'FRUSTRATED', label: '挫折', color: '#722ed1' },
    { value: 'IMPATIENT', label: '不耐煩', color: '#f5222d' },
    { value: 'NEUTRAL', label: '中性', color: '#8c8c8c' }
  ]

  const positionColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 100,
      editable: true,
    },
    {
      title: '動作',
      dataIndex: 'action',
      width: 80,
      editable: true,
      render: (text) => (
        <Tag color={text === 'buy' ? 'green' : 'red'}>
          {text === 'buy' ? '買入' : '賣出'}
        </Tag>
      ),
    },
    {
      title: '價格',
      dataIndex: 'price',
      width: 80,
      editable: true,
      render: (text) => text ? `$${parseFloat(text).toFixed(2)}` : '-',
    },
    {
      title: '數量',
      dataIndex: 'shares',
      key: 'shares',
      width: 80,
      editable: true,
      render: (text) => text ? text.toLocaleString() : '-',
    },
    {
      title: '停損價',
      dataIndex: 'stopLoss',
      key: 'stopLoss',
      width: 80,
      editable: true,
      render: (text) => text ? `$${parseFloat(text).toFixed(2)}` : '-',
    },
    {
      title: '備註',
      dataIndex: 'note',
      key: 'note',
      width: 200,
      editable: true,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      width: 120,
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Typography.Link onClick={() => save(record.key)} style={{ marginInlineEnd: 8 }}>
              儲存
            </Typography.Link>
            <Popconfirm title="確定要取消修改嗎?" onConfirm={cancel} okText="確定" cancelText="取消">
              <a>取消</a>
            </Popconfirm>
          </span>
        ) : (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => edit(record)}
              size="small"
              disabled={editingKey !== ''}
              title="編輯"
            />
            <Popconfirm 
              title="確定要刪除這筆記錄嗎？" 
              onConfirm={() => handleDeletePosition(record.id || record.key)}
              okText="確定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                disabled={editingKey !== ''}
                title="刪除"
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];
  
  const edit = record => {
    form.setFieldsValue({
      ...record, 
      date: record.date ? dayjs(record.date) : null
    });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const save = async key => {
    try {
      const row = await form.validateFields();
      const newData = [...positionAdjustments];
      const index = newData.findIndex(item => key === item.key || key === item.id);
      
      if (index > -1) {
        const item = newData[index];
        const updatedItem = {
          ...item,
          ...row,
          date: row.date || item.date, // 保持 dayjs 物件或字符串，DTO 會處理
        };
        
        // 調用父組件的更新函數，傳遞 positionId 和更新資料
        if (onEditPosition) {
          await onEditPosition(tradeId, item.id || item.key, updatedItem);
        }
        setEditingKey('');
        // 重新載入資料
        refetchTrade();
      }
    } catch (errInfo) {
      console.log('Validate Failed:', errInfo);
    }
  };

  const mergedColumns = positionColumns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: record => ({
        record,
        inputType: ['price', 'shares', 'stopLoss'].includes(col.dataIndex) 
          ? 'number' 
          : col.dataIndex === 'date' 
            ? 'date' 
            : col.dataIndex === 'action'
              ? 'select'
              : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  const handleAddPosition = () => {
    if (onAddPosition) {
      onAddPosition(tradeId);
    }
  }

  const handleDeletePosition = async (positionIdOrKey) => {
    if (onDeletePosition) {
      await onDeletePosition(tradeId, positionIdOrKey);
      // 重新載入資料
      refetchTrade();
    }
  }

  // 處理刪除交易
  const handleDeleteTradeClick = async () => {
    if (!onDeleteTrade || !tradeId) return
    await onDeleteTrade(tradeId)
  }

  // 初始化表單資料
  useEffect(() => {
    if (tradeData) {
      reviewForm.setFieldsValue({
        content: tradeData.reviewNotes || '',
        errorCategory: tradeData.errorCategory || '',
        emotion: tradeData.emotion || '',
        followedDiscipline: tradeData.followedDiscipline === 'pass',
        selfRating: tradeData.selfRating || 0,
      });
    }
  }, [tradeData, reviewForm]);

  // 處理保存檢討
  const handleSaveReview = async () => {
    try {
      // 非必填欄位，即使驗證失敗也取得表單值
      const values = await reviewForm.validateFields().catch(() => reviewForm.getFieldsValue());
      
      if (onSaveReview) {
        // 只發送有值的欄位
        const reviewData = {};
        if (values.content !== undefined && values.content !== null && values.content !== '') {
          reviewData.reviewNotes = values.content;
        }
        if (values.errorCategory !== undefined && values.errorCategory !== null && values.errorCategory !== '') {
          reviewData.errorCategory = values.errorCategory;
        }
        if (values.emotion !== undefined && values.emotion !== null && values.emotion !== '') {
          reviewData.emotion = values.emotion;
        }
        if (values.followedDiscipline !== undefined && values.followedDiscipline !== null) {
          reviewData.followedDiscipline = values.followedDiscipline ? 'yes' : 'no';
        }
        if (values.selfRating !== undefined && values.selfRating !== null && values.selfRating !== 0) {
          reviewData.selfRating = values.selfRating;
        }
        
        // 只有當有至少一個欄位有值時才保存
        if (Object.keys(reviewData).length > 0) {
          await onSaveReview(tradeId, reviewData);
          message.success('檢討內容已保存');
          refetchTrade();
        } else {
          message.info('請至少填寫一項檢討內容');
        }
      }
    } catch (error) {
      console.error('保存檢討失敗:', error);
    }
  };

  if (tradeError) {
    message.error(tradeError.msg || '載入交易詳情失敗');
  }

  return (
    <Drawer
      title="交易詳情"
      placement="right"
      width={drawerWidth}
      onClose={onClose}
      open={visible}
      className="TradeDrawer"
      classNames={{
        header: 'py-base px-md',
        body: 'p-md',
      }}
      styles={isWideLayout ? { body: { overflow: 'hidden' } } : undefined}
      getContainer={false}
      extra={
        <Space>
          <Popconfirm
            title="刪除交易"
            description="將刪除此交易及其所有倉位記錄，此操作無法復原，確定要刪除嗎？"
            okText="刪除"
            okType="danger"
            cancelText="取消"
            onConfirm={handleDeleteTradeClick}
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              className="TradeDrawer-delete-btn"
            >
              刪除
            </Button>
          </Popconfirm>

          <Button className="rounded-sm" onClick={onClose}>
            取消
          </Button>
          <Button 
            className="rounded-sm" 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSaveReview}
            loading={tradeLoading}
          >
            保存檢討
          </Button>
        </Space>
      }
    >
      {tradeLoading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : tradeData ? (
        <div style={isWideLayout ? { display: 'flex', gap: 16, height: '100%' } : undefined}>
          {/* 左欄（wide 60%）/ 上方（narrow）：K 線圖 + 倉位記錄（與 K 線上的買賣標記同邊，視覺一致） */}
          <PerfectScrollbar
            options={{ suppressScrollX: true, wheelPropagation: false }}
            style={isWideLayout
              ? { flex: 1, minWidth: 0, paddingRight: 4 }
              : undefined}
          >
            {/* K 線圖 */}
            <Card
              title="K 線圖"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <KLineChart
                symbol={tradeData.symbol}
                positions={positionAdjustments}
                height={isWideLayout ? wideChartHeight : 400}
              />
            </Card>

            {/* 倉位記錄 */}
            <Card
              title="倉位記錄"
              size="small"
              style={{ marginBottom: 16 }}
              extra={
                <Button
                  type="default"
                  icon={<PlusOutlined />}
                  size='small'
                  className='rounded-sm text-grey-400 bg-white bd-grey-200 shadow-none hover:bg-white'
                  onClick={handleAddPosition}
                >
                  新增倉位
                </Button>
              }
            >
              <div className='mb-md'>
                <Form form={form} component={false}>
                  <Table
                    components={{
                      body: { cell: EditableCell },
                    }}
                    bordered
                    dataSource={positionAdjustments}
                    columns={mergedColumns}
                    rowClassName="editable-row"
                    size="small"
                    pagination={false}
                  />
                </Form>
              </div>
            </Card>
          </PerfectScrollbar>

          {/* 右欄（wide 40%）/ 下方（narrow）：交易摘要 + 交易檢討 */}
          <PerfectScrollbar
            options={{ suppressScrollX: true, wheelPropagation: false }}
            style={isWideLayout
              ? { flex: '0 0 40%', minWidth: 0, paddingRight: 4 }
              : undefined}
          >
            {/* 交易摘要：單一 block，分四層（header strip / KPI hero / 細節雙欄 / footer） */}
            <Card title="交易摘要" size="small" style={{ marginBottom: 16 }}>
              {/* Header strip：股號 + 方向 + 狀態 + 策略 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 'bold' }}>{tradeData.symbol}</span>
                <Tag color={tradeData.direction === 'long' ? 'green' : 'red'} style={{ margin: 0 }}>
                  {tradeData.direction === 'long' ? '多' : '空'}
                </Tag>
                <Tag color={tradeData.status === 'open' ? 'orange' : 'default'} style={{ margin: 0 }}>
                  {tradeData.status === 'open' ? '持倉中' : '已完成'}
                </Tag>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>
                  策略：{(() => {
                    if (!tradeData.strategy) return '-'
                    if (typeof tradeData.strategy === 'object' && tradeData.strategy !== null) {
                      return tradeData.strategy.name || '-'
                    }
                    return tradeData.strategy
                  })()}
                </span>
              </div>

              {/* 期間 subtitle：在 header 下方一點，小灰字 */}
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 14 }}>
                {tradeData.createdAt ? dayjs(tradeData.createdAt).format('YYYY/MM/DD') : '—'}
                {' → '}
                {tradeData.closedAt ? dayjs(tradeData.closedAt).format('YYYY/MM/DD') : '—'}
              </div>

              {/* 2-col sections：持倉資訊 | 損益明細 */}
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, paddingRight: 12, borderRight: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', marginBottom: 8 }}>持倉資訊</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>數量</span>
                      <span>{tradeData.totalShares?.toLocaleString() || 0} 股</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>平均買價</span>
                      <span>${tradeData.avgPrice ? parseFloat(tradeData.avgPrice).toFixed(2) : '0.00'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>平均賣價</span>
                      <span>{tradeData.avgSellPrice != null ? `$${parseFloat(tradeData.avgSellPrice).toFixed(2)}` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>建倉成本</span>
                      <span>${tradeData.totalValue ? parseFloat(tradeData.totalValue).toFixed(2) : '0.00'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>持倉天數</span>
                      <span>
                        {tradeData.holdingDuration != null
                          ? (parseFloat(tradeData.holdingDuration) <= 0 ? '當日' : `${parseFloat(tradeData.holdingDuration).toFixed(1)} 天`)
                          : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>建倉次數</span>
                      <span>{tradeData.entryCount ?? positionAdjustments.length ?? 0} 次</span>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, paddingLeft: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', marginBottom: 8 }}>損益明細</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>淨損益</span>
                      <span style={{ color: pnlColor(tradeData.netProfitLoss), fontWeight: 500 }}>
                        {tradeData.netProfitLoss > 0 ? '+' : ''}{tradeData.netProfitLoss?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>盈虧比例</span>
                      <span style={{ color: (tradeData.profitLossRatio || 0) >= 0 ? CLR_UP : CLR_DOWN, fontWeight: 500 }}>
                        {tradeData.profitLossRatio >= 0 ? '+' : ''}{((tradeData.profitLossRatio || 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>已實現</span>
                      <span style={{ color: pnlColor(tradeData.profitLoss), fontWeight: 500 }}>
                        {tradeData.profitLoss > 0 ? '+' : ''}{tradeData.profitLoss?.toLocaleString() || 0}
                      </span>
                    </div>
                    {tradeData.status === 'open' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8c8c8c' }}>未實現</span>
                        <span style={{ color: tradeData.unrealizedPnL != null ? pnlColor(tradeData.unrealizedPnL) : '#8c8c8c', fontWeight: 500 }}>
                          {tradeData.unrealizedPnL != null
                            ? `${tradeData.unrealizedPnL > 0 ? '+' : ''}${tradeData.unrealizedPnL.toLocaleString()}`
                            : '—'}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>手續費</span>
                      <span>{tradeData.totalFee ? `-${tradeData.totalFee.toLocaleString()}` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8c8c8c' }}>稅</span>
                      <span>{tradeData.totalTax ? `-${tradeData.totalTax.toLocaleString()}` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* 交易檢討：欄位垂直堆疊（左欄較窄不適合內部再分左右） */}
            <Card title="交易檢討" size="small" style={{ marginBottom: 16 }}>
              <Form
                form={reviewForm}
                layout="vertical"
                size="small"
              >
                <Form.Item
                  label="檢討內容"
                  name="content"
                >
                  <TextArea
                    rows={6}
                    placeholder="請詳細描述這次交易的檢討內容，包括成功或失敗的原因、學到的經驗、下次如何改進等..."
                    maxLength={1000}
                    showCount
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="錯誤分類"
                      name="errorCategory"
                    >
                      <Select placeholder="請選擇主要錯誤類型">
                        {errorCategories.map(category => (
                          <Option key={category.value} value={category.value}>
                            {category.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="當時情緒"
                      name="emotion"
                    >
                      <Select placeholder="請選擇交易時的情緒狀態">
                        {emotions.map(emotion => (
                          <Option key={emotion.value} value={emotion.value}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: emotion.color
                                }}
                              />
                              {emotion.label}
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="是否遵守紀律"
                      name="followedDiscipline"
                      valuePropName="checked"
                    >
                      <Switch
                        checkedChildren="是"
                        unCheckedChildren="否"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="自我評分"
                      name="selfRating"
                    >
                      <Rate
                        count={5}
                        tooltips={['1分', '2分', '3分', '4分', '5分']}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <div style={{
                  padding: 8,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  fontSize: '11px',
                  color: '#666',
                  lineHeight: '1.3'
                }}>
                  <strong>評分說明：</strong>1分：表現不佳，2分：表現較差，3分：一般水準，4分：表現良好，5分：完美執行
                </div>
              </Form>
            </Card>
          </PerfectScrollbar>
        </div>
      ) : null}
    </Drawer>
  )
}

export default TradeDrawer
