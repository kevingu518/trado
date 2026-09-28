import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Card } from 'antd';
import { UserOutlined, DollarOutlined, SettingOutlined, ThunderboltOutlined, RobotOutlined } from '@ant-design/icons';
import ProfileSettings from '../components/ProfileSettings';
import BalanceManagement from '../components/BalanceManagement';
import FeeSettings from '../components/FeeSettings';
import ShortcutSettings from '../components/ShortcutSettings';
import AISettings from '@/features/aiAnalysis/components/AISettings';

const TAB_KEY_MAP = { profile: '1', balance: '2', trade: '3', shortcut: '4', ai: '5' };

const Settings = () => {
  const [searchParams] = useSearchParams();
  const [activeKey, setActiveKey] = useState(TAB_KEY_MAP[searchParams.get('tab')] || '1');

  const items = [
    {
      key: '1',
      label: (
        <span className='flex items-center gap-sm'>
          <UserOutlined />
          個人資料
        </span>
      ),
      children: <ProfileSettings />,
    },
    {
      key: '2',
      label: (
        <span className='flex items-center gap-sm'>
          <DollarOutlined />
          資金管理
        </span>
      ),
      children: <BalanceManagement />,
    },
    {
      key: '3',
      label: (
        <span className='flex items-center gap-sm'>
          <SettingOutlined />
          交易設定
        </span>
      ),
      children: <FeeSettings />,
    },
    {
      key: '4',
      label: (
        <span className='flex items-center gap-sm'>
          <ThunderboltOutlined />
          快捷鍵
        </span>
      ),
      children: <ShortcutSettings />,
    },
    {
      key: '5',
      label: (
        <span className='flex items-center gap-sm'>
          <RobotOutlined />
          AI 設定
        </span>
      ),
      children: <AISettings />,
    },
  ];

  return (
    <div className='p-md h-full'>
      <Card className='rounded-base full-height'>
        <Tabs activeKey={activeKey} onChange={setActiveKey} items={items} />
      </Card>
    </div>
  );
};

export default Settings;
