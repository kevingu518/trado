import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Tooltip, Button, Avatar, Popover } from 'antd';
import { 
  BarChartOutlined, 
  ProfileOutlined,
  DashboardOutlined, 
  SettingOutlined,
  UserOutlined,
  LineChartOutlined,
  ContainerOutlined,
  HighlightOutlined,
} from '@ant-design/icons';
import { FaRegUser } from "react-icons/fa";
import { logout } from '../api/api_user';
import { logout as sliceLogout } from '../store/authSlice';
import { useDispatch } from 'react-redux';
import { message } from 'antd';
import { to } from 'await-to-js';
import { useUserInfo } from '../hooks/useUserInfo';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { ShortcutListPopover } from '@/shortcuts';
import PerfectScrollbar from 'react-perfect-scrollbar';

const items = [
  {
    key: '1',
    icon: <HighlightOutlined />,
    label: '交易紀錄',
  },
  {
    key: '2',
    icon: <DashboardOutlined />,
    label: '儀表板',
  },
  {
    key: '3',
    icon: <ContainerOutlined />,
    label: '策略',
  },
  {
    key: '4',
    icon: <SettingOutlined />,
    label: '設定',
  },
];

// 路由到選單 key 的映射
const pathToKeyMap = {
  '/trades': '1',
  '/transactions': '1', // transactions 也對應交易紀錄
  '/dashboard': '2',
  '/strategy': '3',
  '/settings': '4',
};

// 選單 key 到路由的映射
const keyToPathMap = {
  '1': '/trades',
  '2': '/dashboard',
  '3': '/strategy',
  '4': '/settings',
};

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // 根據當前路徑設置選中的 key
  const getSelectedKeyFromPath = (pathname) => {
    // 先檢查完整路徑匹配（最精確的匹配）
    if (pathToKeyMap[pathname]) {
      return pathToKeyMap[pathname];
    }
    
    // 按路徑長度降序排序，優先匹配更長的路徑（避免 /dashboard 匹配到 /trades）
    const sortedPaths = Object.entries(pathToKeyMap).sort((a, b) => b[0].length - a[0].length);
    
    // 檢查路徑是否以某個路由開頭
    for (const [path, key] of sortedPaths) {
      // 確保路徑以該路由開頭，且下一個字符是 '/' 或路徑結束（避免部分匹配）
      if (pathname.startsWith(path) && (pathname.length === path.length || pathname[path.length] === '/')) {
        return key;
      }
    }
    
    return '1'; // 默認選中第一個
  };

  const [selectedKeys, setSelectedKeys] = useState([getSelectedKeyFromPath(location.pathname)]);

  // 從 Redux store 取得使用者資訊
  const { email, name, picture } = useUserInfo();
  
  // 從 ThemeContext 取得主題
  const { theme } = useTheme();

  // 當路徑改變時，更新選中的 key
  useEffect(() => {
    const key = getSelectedKeyFromPath(location.pathname);
    setSelectedKeys([key]);
  }, [location.pathname]);

  // dispatch(sliceLogout());
  // 處理選單選擇
  const handleMenuSelect = ({ key }) => {
    // 如果選中的是 user 項目，不更新選中狀態
    if (key === '5') {
      return;
    }
    setSelectedKeys([key]);
    
    // 導航到對應路由
    if (keyToPathMap[key]) {
      navigate(keyToPathMap[key]);
    }
  };

  // 登出處理
  const handleLogout = async () => {
    console.log('登出');
    // 這裡添加登出邏輯

    // call api
    const [error, response] = await to(logout());
    if (error) {
      message.error(error.message);
      return;
    }
    message.success('登出成功');
    navigate('/auth/login');

    // 清除 Redux 狀態
    dispatch(sliceLogout());
    // 清除 sessionStorage
    sessionStorage.removeItem('access_token');
  };
  // ------------------------   component  ------------------------
  const userMenuContent = () => (
    <Popover 
      content={
        <div>
          {name && <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{name}</div>}
          {email && <div style={{ marginBottom: 12, fontSize: '12px', color: '#666' }}>{email}</div>}
          <Button variant='outlined' block onClick={handleLogout}>登出</Button>
        </div>
      } 
      title="使用者資訊" 
      placement="rightBottom" 
      className='mb-xs mx-xs'
      >
      <Button 
        type="primary" 
        color="default" 
        variant="text" 
        className='p-none'
        style={{ height: '40px' }}
      >
        {picture ? (
          <Avatar src={picture} size="small" icon={<UserOutlined />} />
        ) : (
          <FaRegUser />
        )}
      </Button>
    </Popover>
  )
  return (
    <div 
      className={`MainLayout`}
      style={{
        background: theme.gradient, // 動態設定漸層背景
      }}
    >
      {/* 側邊欄 */}
      <section className='MainLayout-sider pa-xs'>
        {/* 主要選單 */}
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={items}
          className="custom-menu main-menu"
          inlineCollapsed={true}
          onSelect={handleMenuSelect}
        />
        
        {/* 底部選單 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <ShortcutListPopover />
          <ThemeSwitcher />
          { userMenuContent() }
        </div>
      </section>
      {/* 主要內容區 */}
      <section className='MainLayout-content'>
        <PerfectScrollbar className="MainLayout-scroll">
          <Outlet />
        </PerfectScrollbar>
      </section>
    </div>
  )
}

export default MainLayout