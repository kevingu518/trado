// src/pages/Transactions/components/TransactionDrawer.jsx
import React, { useState } from 'react'
import { 
  Drawer, Row, Col, Descriptions, Card, Divider, Form, Input, Select, Rate, 
  Button, Space, Table, Tag, message, InputNumber, DatePicker, Progress, Switch ,Popconfirm, Typography
} from 'antd'
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

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

const originData = Array.from({ length: 8 }).map((_, i) => ({
  key: i.toString(),
  date: `2024-01-${i+1}`,
  action: '買進',
  price: 100,
  quantity: 100,
  stopLoss: 100,
  notes: 'notes',
}));
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
          <Option label="買入" value="買入"></Option>
          <Option label="賣出" value="賣出"></Option>
        </Select>) 
      : inputType === 'date' 
        ? <DatePicker format="YYYY-MM-DD" /> 
        : <Input />;
  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[
            {
              required: true,
              message: `Please Input ${title}!`,
            },
          ]}
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

const TransactionDrawer = ({ 
  visible, 
  onClose, 
  selectedRecord, 
  onSaveReview, 
  onAddFill, 
  onEditFill, 
  onDeleteFill 
}) => {
  console.log('selectedRecord', selectedRecord)
  // ------------------ variables ------------------
  // const [fillForm] = Form.useForm()   // 倉位表單
  const [reviewForm] = Form.useForm() // 檢討表單
  // const [editingFill, setEditingFill] = useState(null)

  // 表格編輯相關
  const [form] = Form.useForm();
  const [data, setData] = useState(originData);
  const [editingKey, setEditingKey] = useState('');
  const isEditing = record => record.key === editingKey;
  // ------------------  configs  ------------------

  // 錯誤分類選項
  const errorCategories = [
    { value: 'technical', label: '技術分析錯誤' },
    { value: 'fundamental', label: '基本面分析錯誤' },
    { value: 'timing', label: '進出場時機錯誤' },
    { value: 'risk', label: '風險控制不當' },
    { value: 'emotion', label: '情緒影響判斷' },
    { value: 'strategy', label: '策略執行偏差' },
    { value: 'market', label: '市場環境誤判' },
    { value: 'other', label: '其他' }
  ]

  // 情緒選項
  const emotions = [
    { value: 'confident', label: '自信', color: '#52c41a' },
    { value: 'calm', label: '冷靜', color: '#1890ff' },
    { value: 'anxious', label: '焦慮', color: '#faad14' },
    { value: 'greedy', label: '貪婪', color: '#ff7a45' },
    { value: 'fearful', label: '恐懼', color: '#ff4d4f' },
    { value: 'frustrated', label: '沮喪', color: '#722ed1' },
    { value: 'excited', label: '興奮', color: '#eb2f96' },
    { value: 'neutral', label: '平靜', color: '#8c8c8c' }
  ]
  const fillColumns = [
    {
      title: '日期  ',
      dataIndex: 'date',
      width: 100,
      editable: true,
    },
    {
      title: '動作',
      dataIndex: 'action',
      width: 80,
      editable: true,
    },
    {
      title: '價格',
      dataIndex: 'price',
      width: 80,
      editable: true,
    },
    {
      title: '數量',
      dataIndex: 'quantity',
      width: 80,
      editable: true,
    },
    {
      title: '停損價',
      dataIndex: 'stopLoss',
      width: 80,
      editable: true,
    },
    {
      title: '備註',
      dataIndex: 'notes',
      width: 200,
      editable: true,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      width: 80,
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
              onConfirm={() => handleDeleteFill(record.key)}
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
      const newData = [...data];
      const index = newData.findIndex(item => key === item.key);
      
      if (index > -1) {
        const item = newData[index];
        const updatedItem = {
          ...item,
          ...row,
          // 確保日期格式正確
          date: row.date ? row.date.format('YYYY-MM-DD') : null
        };
        newData.splice(index, 1, updatedItem);
        setData(newData);
        
        // 調用父組件的更新函數
        onEditFill(selectedRecord.key, index, updatedItem);
        message.success('倉位記錄已更新');
        setEditingKey('');
      } else {
        const newItem = {
          ...row,
          key: `new-${Date.now()}`,
          date: row.date ? row.date.format('YYYY-MM-DD') : null
        };
        newData.push(newItem);
        setData(newData);
        
        // 調用父組件的添加函數
        onAddFill(selectedRecord.key, newItem);
        message.success('倉位記錄已添加');
        setEditingKey('');
      }
    } catch (errInfo) {
      console.log('Validate Failed:', errInfo);
    }
  };

  const mergedColumns = fillColumns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: record => ({
        record,
        inputType: ['price', 'quantity', 'stopLoss'].includes(col.dataIndex) 
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
  const handleAddFill = () => {
    const newRow = {
      key: `new-${Date.now()}`,
      date: '',
      action: '買進',
      price: 0,
      quantity: 0,
      stopLoss: 0,
      notes: '',
    };
    
    // 添加到數據中
    setData([newRow, ...data]);
    
    // 立即進入編輯模式
    form.setFieldsValue({
      ...newRow,
      date: null
    });
    setEditingKey(newRow.key);
    
    message.success('已添加新行，請填寫資料');
  }
  const handleDeleteFill = (key) => {
    const newData = data.filter(item => item.key !== key);
    setData(newData);
    message.success('倉位記錄已刪除');
  }

  // 計算持倉統計
  const calculatePositionStats = () => {
    if (!selectedRecord?.fills) return { totalQuantity: 0, avgPrice: 0, totalValue: 0 }

    let totalQuantity = 0
    let totalValue = 0

    selectedRecord.fills.forEach(fill => {
      if (fill.action === 'buy') {
        totalQuantity += fill.quantity
        totalValue += fill.price * fill.quantity
      } else {
        totalQuantity -= fill.quantity
        totalValue -= fill.price * fill.quantity
      }
    })

    const avgPrice = totalQuantity !== 0 ? totalValue / totalQuantity : 0

    return {
      totalQuantity,
      avgPrice: avgPrice.toFixed(2),
      totalValue: totalValue.toFixed(2)
    }
  }

  // 計算盈虧統計
  const calculateProfitStats = () => {
    const profit = selectedRecord?.result || 0
    const totalAssets = 1000000 // 假設總資產
    const profitRatio = ((profit / totalAssets) * 100).toFixed(2)
    
    return {
      profitAmount: profit,
      profitRatio: profitRatio
    }
  }

  const positionStats = calculatePositionStats()
  const profitStats = calculateProfitStats()

  return (
    <Drawer
      title="交易詳情"
      placement="right"
      width={1000}
      onClose={onClose}
      open={visible}
      classNames={{
        header: 'py-base px-md',
        body: 'p-md',
      }}
      extra={
        <Space>
          <Button className="rounded-sm" onClick={onClose}>
            取消
          </Button>
          <Button className="rounded-sm" type="primary" icon={<SaveOutlined />} onClick={onSaveReview}>
            保存檢討
          </Button>
        </Space>
      }
    >
      {selectedRecord && (
        <div>
          {/* 第一行：基本資訊、持倉統計、盈虧分析 - 三等分，統一格式 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {/* 基本資訊 */}
            <Col span={8}>
              <Card title="基本資訊" size="small" style={{ height: '100%' }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="股號">
                    {selectedRecord.stockCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="方向">
                    <Tag color={selectedRecord.direction === 'LONG' ? 'green' : 'red'}>
                      {selectedRecord.direction === 'LONG' ? '多' : '空'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="開倉日">
                    {selectedRecord.openDate}
                  </Descriptions.Item>
                  <Descriptions.Item label="清倉日">
                    {selectedRecord.closeDate || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="狀態">
                    <Tag color={selectedRecord.status === 'open' ? 'orange' : 'default'}>
                      {selectedRecord.status === 'open' ? '持倉中' : '已完成'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* 持倉統計 */}
            <Col span={8}>
              <Card title="持倉統計" size="small" style={{ height: '100%' }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="總數量">
                    {positionStats.totalQuantity.toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="平均價格">
                    ${positionStats.avgPrice}
                  </Descriptions.Item>
                  <Descriptions.Item label="總價值">
                    ${positionStats.totalValue}
                  </Descriptions.Item>
                  <Descriptions.Item label="策略">
                    {selectedRecord.details?.strategy || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="備註">
                    {selectedRecord.details?.notes || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* 盈虧分析 */}
            <Col span={8}>
              <Card title="盈虧分析" size="small" style={{ height: '100%' }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="盈虧金額">
                    <span style={{ 
                      color: profitStats.profitAmount > 0 ? '#52c41a' : profitStats.profitAmount < 0 ? '#ff4d4f' : '#666',
                      fontWeight: 'bold'
                    }}>
                      {profitStats.profitAmount > 0 ? '+' : ''}{profitStats.profitAmount.toLocaleString()} 元
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="盈虧比例">
                    <span style={{ 
                      color: parseFloat(profitStats.profitRatio) >= 0 ? '#52c41a' : '#ff4d4f',
                      fontWeight: 'bold'
                    }}>
                      {parseFloat(profitStats.profitRatio) >= 0 ? '+' : ''}{profitStats.profitRatio}%
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="手續費">
                    {selectedRecord.details?.commission ? `${selectedRecord.details.commission.toLocaleString()} 元` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="淨損益">
                    <span style={{ 
                      color: selectedRecord.details?.netProfit > 0 ? '#52c41a' : selectedRecord.details?.netProfit < 0 ? '#ff4d4f' : '#666',
                      fontWeight: 'bold'
                    }}>
                      {selectedRecord.details?.netProfit > 0 ? '+' : ''}{selectedRecord.details?.netProfit?.toLocaleString() || 0} 元
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="總資產比例">
                    {profitStats.profitRatio}%
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

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
              onClick={handleAddFill}>
                新增倉位
              </Button>}
            >
            <div className='mb-md'>
              <Form form={form} component={false}>
                <Table
                  components={{
                    body: { cell: EditableCell },
                  }}
                  bordered
                  dataSource={data}
                  columns={mergedColumns}
                  rowClassName="editable-row"
                  size="small"
                  pagination={false}
                />
              </Form>
            </div>

          </Card>

          {/* 交易檢討 - 分左右兩側，優化空間分配 */}
          <Card title="交易檢討" size="small">
            <Row gutter={24}>
              {/* 左側：檢討內容 */}
              <Col span={12}>
                <Form
                  form={reviewForm}
                  layout="vertical"
                  size="small"
                >
                  <Form.Item
                    label="檢討內容"
                    name="content"
                    rules={[{ required: true, message: '請輸入檢討內容' }]}
                  >
                    <TextArea
                      rows={8}
                      placeholder="請詳細描述這次交易的檢討內容，包括成功或失敗的原因、學到的經驗、下次如何改進等..."
                      maxLength={1000}
                      showCount
                    />
                  </Form.Item>
                </Form>
              </Col>

              {/* 右側：優化後的表單佈局 */}
              <Col span={12}>
                <Form
                  form={reviewForm}
                  layout="vertical"
                  size="small"
                >
                  {/* 錯誤分類和情緒 - 上移 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Form.Item
                        label="錯誤分類"
                        name="errorCategory"
                        rules={[{ required: true, message: '請選擇錯誤分類' }]}
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
                        rules={[{ required: true, message: '請選擇當時情緒' }]}
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

                  {/* 紀律和評分 - 緊湊佈局 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Form.Item
                        label="是否遵守紀律"
                        name="discipline"
                        rules={[{ required: true, message: '請選擇是否遵守紀律' }]}
                        initialValue={selectedRecord.discipline === 'pass'}
                        style={{ marginBottom: 8 }}
                      >
                        <Switch 
                          checkedChildren="是" 
                          unCheckedChildren="否"
                          checked={selectedRecord.discipline === 'pass'}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="自我評分"
                        name="selfRating"
                        rules={[{ required: true, message: '請進行自我評分' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Rate 
                          allowHalf 
                          count={5}
                          tooltips={['很差', '差', '一般', '好', '很好']}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* 評分說明 - 緊湊版本 */}
                  <div style={{ 
                    padding: 8, 
                    background: '#f5f5f5', 
                    borderRadius: 4,
                    fontSize: '11px',
                    color: '#666',
                    lineHeight: '1.3'
                  }}>
                    <strong>評分說明：</strong>1分：完全失敗，2分：表現不佳，3分：一般水準，4分：表現良好，5分：完美執行
                  </div>
                </Form>
              </Col>
            </Row>
          </Card>
        </div>
      )}
    </Drawer>
  )
}

export default TransactionDrawer