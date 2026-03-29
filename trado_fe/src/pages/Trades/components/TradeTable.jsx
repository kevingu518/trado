import { useEffect, useState } from 'react'
import { Form, Table, Popconfirm, Typography, Input, Select, DatePicker } from 'antd'
// 第三方套件
import dayjs from 'dayjs'
// icons
import { MdOutlineModeEdit } from 'react-icons/md'
import { CgNotes } from 'react-icons/cg'


// 表格資料 - 示範用
const tableData = [];
for (let i = 0; i < 21; i++) {
  tableData.push({
    key: i.toString(),
    stockNum: '2498',
    type: i % 4 === 0 ? '空' : '多',
    buyTime: '09-05 09:33',
    buyPrice: 40,
    buyStockNum: 1000,
    sellTime: '09-20 10:52',
    sellPrice: 48.7,
    sellStockNum: 1000,
    cost: 40000,
    winLose: i % 3 === 0 ? '勝' : '敗',
    strategy: '波段',
    stopLossPrice: 38,
    holdingTime: '3天4小時',
    outcome: Number(10000).toLocaleString(),
    outcomeRatio: '3.2%',
    description: 'test',
  },);
}

const TradeTable = () => {
  
  // -------------------------   variables   ----------------------------
  const [form] = Form.useForm();  
  const [data, setData] = useState(tableData);
  const [editingKey, setEditingKey] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  
  const [tableHeight, setTableHeight] = useState(400);
  //$ 資料
  const [serverRecords, setServerRecords] = useState(tableData);

  const isEditing = (record) => record.key === editingKey;
  // 表格欄位
  const columns = [
    {
      title: '方向',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      render: (_, { type }) => (<span className={`table-tag ${type === '多' ? 'table-tag-long' : 'table-tag-short'}`} >{type}</span>)
    },
    {
      title: '股號',
      dataIndex: 'stockNum',
      key: 'stockNum',
      width: 80,
      editable: true,
      fixed: 'left',
      className: 'fixed-column-left',
    },
    {
      title: '買進時間',
      dataIndex: 'buyTime',
      key: 'buyTime',
      width: 120,
      editable: true,
      inputType: 'date',
      onCell: () => ({
        style: { minWidth: '120px', maxWidth: '180px' }
      })
    },
    {
      title: '賣出時間',
      dataIndex: 'sellTime',
      key: 'sellTime',
      inputType: 'date',
      width: 120,
      editable: true,
    },
    {
      title: '買價',
      dataIndex: 'buyPrice',
      key: 'buyPrice',
      width: 80,
      editable: true,
    },
    {
      title: '買進股數',
      dataIndex: 'buyStockNum',
      key: 'buyStockNum',
      width: 100,
      editable: true,
    },

    {
      title: '賣價',
      dataIndex: 'sellPrice',
      key: 'sellPrice',
      width: 80,
      editable: true,
    },
    {
      title: '賣出股數',
      dataIndex: 'sellStockNum',
      key: 'sellStockNum',
      width: 100,
      editable: true,
    },
    {
      title: '停損價',
      dataIndex: 'stopLossPrice',
      key: 'stopLossPrice',
      width: 100,
      editable: true,
    },
    // {
    //   title: '成本',
    //   dataIndex: 'cost',
    //   key: 'cost',
    // },
    {
      title: '勝敗',
      dataIndex: 'winLose',
      key: 'winLose',
      render: (_, { winLose }) => (<span className={`winLose-tag ${winLose === '勝' ? 'winLose-tag-win' : 'winLose-tag-lose'}`}>{winLose}</span>),
      width: 60,
    },
    {
      title: '損益',
      dataIndex: 'outcome',
      key: 'outcome',
      width: 100,
      onCell: () => ({
        style: { minWidth: '120px', maxWidth: '180px' }
      })
    },
    {
      title: '損益資產比',
      dataIndex: 'outcomeRatio',
      key: 'outcomeRatio',
      width: 120,
      onCell: () => ({
        style: { minWidth: '120px', maxWidth: '180px' }
      })
    },
    {
      title: '持有時間',
      dataIndex: 'holdingTime',
      key: 'holdingTime',
      width: 100,
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 100,
      editable: true,
      render: (_, { strategy }) => (<span className='strategy-tag'>{strategy}</span>)
    },
    {
      title: '操作',
      dataIndex: 'operation',
      width: 100,
      fixed: 'right',
      className: 'fixed-column',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <span onClick={(e) => { e.stopPropagation() }}>
            <Typography.Link
              onClick={() => save(record.key)}
              style={{
                marginInlineEnd: 8,
              }}
            >
              儲存
            </Typography.Link>
            <Popconfirm title="取消修改?" okText="確認" cancelText="取消" onConfirm={cancel}>
              <a>取消</a>
            </Popconfirm>
          </span>
        ) : (
          <span className='useStart' onClick={(e) => { e.stopPropagation() }}>
            <Typography.Link
              disabled={editingKey !== ''}
              onClick={() => edit(record)}
              style={{
                marginInlineEnd: 8,
              }}>
              <MdOutlineModeEdit size={20} />
            </Typography.Link>
            <span >
              <CgNotes size={20} className='cup' onClick={() => { onShowDrawer() }} />
            </span>
          </span>
        );
      },
    },

  ];

  // -------------------------   functions   ----------------------------
  // 編輯資料
  const edit = (record) => {
    // 設置表單值
    form.setFieldsValue({
      ...record,
      buyTime: record.buyTime ? dayjs(record.buyTime) : null,
      sellTime: record.sellTime ? dayjs(record.sellTime) : null,
    });
    // 紀錄編輯鍵，用來判斷是否正在編輯
    setEditingKey(record.key);
  };
  // 取消編輯
  const cancel = () => {
    setEditingKey('');
  };
  // 儲存資料
  const save = async (key) => {
    try {
      const row = await form.validateFields();    // 表單驗證

      // 處理日期格式
      if (row.buyTime) {
        row.buyTime = row.buyTime.format('YYYY-MM-DD');
      }
      if (row.sellTime) {
        row.sellTime = row.sellTime.format('YYYY-MM-DD');
      }

      const newData = [...data];                  // 複製當前資料
      const index = newData.findIndex((item) => key === item.key);  // 查找編輯的行
      if (index > -1) {
        const item = newData[index];
        newData.splice(index, 1, {
          ...item,
          ...row,
        });
        setData(newData);
        setServerRecords(newData);
        setEditingKey('');
      } else {
        newData.push(row);
        setData(newData);
        setServerRecords(newData);
        setEditingKey('');
      }
    } catch (errInfo) {
      console.log('Validate Failed:', errInfo);
    }
  };

  const handleRowClick = (record) => {
    if (!isEditing(record)) {
      const key = record.key;
      const expanded = expandedRowKeys.includes(key);
      setExpandedRowKeys(expanded ? [] : [key]);
    }
  };

  

  useEffect(() => {
    const calculateHeight = () => {
      const windowHeight = window.innerHeight;
      const calculatedHeight = windowHeight - 152;
      setTableHeight(calculatedHeight);
    };
    
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
  }, []);
  // -------------------------   components   ----------------------------
  // 可編輯表格欄位
  const EditableCell = ({ editing, dataIndex, title, inputType, record, children, ...restProps }) => {
    const inputNode = inputType === 'number'
      ? <Input type="number" />
      : inputType === 'select'
        ? (
          <Select>
            <Option value="波段大師">波段大師</Option>
            <Option value="套利1">套利1</Option>
            <Option value="期現對沖">期現對沖</Option>
          </Select>
        )
        : inputType === 'date'
          ? <DatePicker showTime />
          : <Input />;
    return (
      <td {...restProps}>
        {editing
          ? (
            <Form.Item
              name={dataIndex}
              style={{ margin: 0 }}
              rules={[
                {
                  required: true,
                  message: `請輸入 ${title}!`,
                },
              ]}
            >
              {inputNode}
            </Form.Item>
          )
          : (children)
        }
      </td>
    );
  };
  // 合併表格欄位，欄位有分顯示和編輯兩種
  const mergedColumns = columns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        inputType: ['buyPrice', 'sellPrice', 'stockNum', 'buyStockNum', 'sellStockNum', 'stopLostPrice'].includes(col.dataIndex)
          ? 'number'
          : col.dataIndex === 'strategy'
            ? 'select'
            : ['buyTime', 'sellTime'].includes(col.dataIndex)
              ? 'date'
              : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });
  return (
    <>
      <Form form={form} component={false} >
        <Table 
          className='table-custom'
          dataSource={serverRecords} 
          columns={mergedColumns}
          size='small'
          // className={styles.customTable}
          scroll={{ x: 'max-content',y: tableHeight }}
          components={{
            body: {
              cell: EditableCell,
            },
          }}
          expandable={{
            expandedRowRender: (record) => <p>檢討：{record.description}</p>,
            expandIcon: () => null, // 隱藏展開的圖標
            expandedRowKeys: expandedRowKeys, // 確保管理展開狀態
            showExpandColumn: false, // 隱藏展開列，且不佔用空間
          }}

          pagination={{
            position: ['topRight'],
            showSizeChanger: true,    // 顯示每頁筆數選擇器
            pageSizeOptions: ['20', '50'], // 可選的每頁筆數
            defaultPageSize: 20,
            size: 'small'
          }}

          onRow={(record) => ({
            onClick: () => handleRowClick(record), // 點擊行展開
          })}
          />
      </Form>
    </>
  )
}

export default TradeTable