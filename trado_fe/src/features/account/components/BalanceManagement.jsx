import React, { useState } from 'react';
import { Button, Space, Table, Tag, DatePicker, Modal, InputNumber, Statistic } from 'antd';
import { PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useBalance, useBalanceHistory } from '../hooks/useAccount';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';
import { useTheme } from '@/contexts/ThemeContext';
import { colorThemes } from '@/config/colorThemes';

const BalanceManagement = () => {
  const { balance, loading, deposit, withdraw, setCashBalance, fetchBalance } = useBalance();
  const { history, loading: historyLoading, pagination, fetchHistory } = useBalanceHistory();
  const { theme } = useTheme();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashInput, setCashInput] = useState(null);
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

  // 處理設定現金餘額
  const handleSetCashBalance = async () => {
    if (cashInput == null || cashInput < 0) return;
    try {
      await setCashBalance(cashInput);
      setCashModalOpen(false);
      setCashInput(null);
      await fetchBalance();
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
        if (record.type === 'set_balance') {
          return (
            <span style={{ fontWeight: 'bold' }}>
              NT$ {amount.toLocaleString()}
            </span>
          );
        }

        const depositColor = colorThemes.red.primary;
        const withdrawColor = colorThemes.green.primary;

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
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const labels = { deposit: '入金', withdraw: '出金', set_balance: '設定餘額' };
        const colors = { deposit: 'red', withdraw: 'green', set_balance: 'blue' };
        return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
      },
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

  const displayHistory = history;

  return (
    <div>
      {/* 當前現金餘額 */}
      <div style={{ marginBottom: 24 }}>
        <Statistic
          title="帳戶現金餘額"
          value={balance.balance}
          prefix="NT$"
          loading={loading}
        />
      </div>

      {/* 操作按鈕 */}
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<EditOutlined />}
          onClick={() => {
            setCashInput(balance.balance);
            setCashModalOpen(true);
          }}
          style={{ borderRadius: '4px' }}
        >
          設定現金餘額
        </Button>
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

      {/* 設定現金餘額 Modal */}
      <Modal
        title="設定現金餘額"
        open={cashModalOpen}
        onCancel={() => setCashModalOpen(false)}
        onOk={handleSetCashBalance}
        confirmLoading={loading}
        okText="確認"
        cancelText="取消"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          輸入你券商帳戶目前的現金餘額，系統會據此計算總資產。
        </p>
        <InputNumber
          style={{ width: '100%' }}
          size="large"
          min={0}
          step={1000}
          prefix="NT$"
          value={cashInput}
          onChange={setCashInput}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value.replace(/,/g, '')}
        />
      </Modal>
    </div>
  );
};

export default BalanceManagement;
