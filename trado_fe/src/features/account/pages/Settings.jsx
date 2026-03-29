import React from 'react';
import { Tabs, Card } from 'antd';
import { UserOutlined, DollarOutlined, SettingOutlined } from '@ant-design/icons';
import ProfileSettings from '../components/ProfileSettings';
import BalanceManagement from '../components/BalanceManagement';
import FeeSettings from '../components/FeeSettings';

const Settings = () => {
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
  ];

  return (
    <div className='p-md'>
      <Card className='rounded-base full-height'>
        <Tabs defaultActiveKey="1" items={items} />
      </Card>
    </div>
  );
};

export default Settings;
