import React, { useState } from 'react';
import { Button, Space, Table, Tag, DatePicker } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useBalance, useBalanceHistory } from '../hooks/useAccount';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';
import { useTheme } from '@/contexts/ThemeContext';
import { colorThemes } from '@/config/colorThemes';

const BalanceManagement = () => {
  const { balance, loading, deposit, withdraw, fetchBalance } = useBalance();
  const { history, loading: historyLoading, pagination, fetchHistory } = useBalanceHistory();
  const { theme } = useTheme();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  // 處理入金
  const handleDeposit = async (data) => {
    try {
      await deposit(data);
      setDepositModalOpen(false);
      await fetchBalance();
      await fetchHistory();
    } catch (error) {
      // 錯誤已在 hook 中處理
    }
  };

  // 處理出金
  const handleWithdraw = async (data) => {
    try {
      await withdraw(data);
      setWithdrawModalOpen(false);
      await fetchBalance();
      await fetchHistory();
    } catch (error) {
      // 錯誤已在 hook 中處理
    }
  };

  // 處理日期範圍變更
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      fetchHistory({
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      });
    } else {
      fetchHistory();
    }
  };

  // 表格欄位定義
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount, record) => {
        // 入金用紅色（主題色），出金用綠色（主題色）
        // 使用專案定義的主題色：紅色主題的 primary 和綠色主題的 primary
        const redThemeColor = colorThemes.red.primary; // '#c92a2a' 紅色
        const greenThemeColor = colorThemes.green.primary; // '#3f8f4e' 綠色
        
        const depositColor = redThemeColor; // 入金用紅色主題色
        const withdrawColor = greenThemeColor; // 出金用綠色主題色
        
        return (
          <span style={{ 
            color: record.type === 'deposit' ? depositColor : withdrawColor,
            fontWeight: 'bold'
          }}>
            {record.type === 'deposit' ? '+' : '-'}NT$ {amount.toLocaleString()}
          </span>
        );
      },
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: '餘額',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => `NT$ ${balance.toLocaleString()}`,
    },
    {
      title: '方式',
      dataIndex: 'method',
      key: 'method',
      render: (method) => method || '-',
    },
    {
      title: '備註',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes) => notes || '-',
      ellipsis: true,
    },
  ];

  // 假資料用於測試顯示
  const mockHistory = [
    {
      id: '1',
      type: 'deposit',
      amount: 100000,
      balance: 1000000,
      date: '2024-01-15',
      method: '銀行轉帳',
      notes: '初始資金',
    },
    {
      id: '2',
      type: 'deposit',
      amount: 50000,
      balance: 1050000,
      date: '2024-01-20',
      method: '銀行轉帳',
      notes: '追加資金',
    },
    {
      id: '3',
      type: 'withdraw',
      amount: 30000,
      balance: 1020000,
      date: '2024-01-25',
      method: '銀行轉帳',
      notes: '提領部分資金',
    },
    {
      id: '4',
      type: 'deposit',
      amount: 20000,
      balance: 1040000,
      date: '2024-02-01',
      method: '現金',
      notes: '',
    },
    {
      id: '5',
      type: 'withdraw',
      amount: 50000,
      balance: 990000,
      date: '2024-02-10',
      method: '銀行轉帳',
      notes: '提領資金',
    },
  ];

  // 使用假資料或真實資料
  const displayHistory = history.length > 0 ? history : mockHistory;

  return (
    <div>
      {/* 操作按鈕 */}
      <Space style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDepositModalOpen(true)}
          style={{ borderRadius: '4px' }}
        >
          入金
        </Button>
        <Button
          danger
          icon={<MinusOutlined />}
          onClick={() => setWithdrawModalOpen(true)}
          style={{ borderRadius: '4px' }}
        >
          出金
        </Button>
      </Space>

      {/* 資金變動歷史 */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            format="YYYY-MM-DD"
            style={{ borderRadius: '4px' }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={displayHistory}
          loading={historyLoading && history.length > 0}
          rowKey="id"
          size='small'
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: displayHistory.length,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 筆記錄`,
          }}
        />
      </div>

      {/* 入金 Modal */}
      <DepositModal
        open={depositModalOpen}
        onCancel={() => setDepositModalOpen(false)}
        onOk={handleDeposit}
        loading={loading}
      />

      {/* 出金 Modal */}
      <WithdrawModal
        open={withdrawModalOpen}
        onCancel={() => setWithdrawModalOpen(false)}
        onOk={handleWithdraw}
        loading={loading}
        availableBalance={balance.availableBalance}
      />
    </div>
  );
};

export default BalanceManagement;
