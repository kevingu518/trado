import { useState, useEffect } from 'react';
import { Avatar, Button, Space, Input, message } from 'antd';
import { UserOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useUserInfo } from '@/hooks/useUserInfo';
import { useAccount } from '../hooks/useAccount';
import { useDispatch } from 'react-redux';
import { setUser } from '@/store/authSlice';

const ProfileSettings = () => {
  const { name, email, picture } = useUserInfo();
  const { loading, updateProfile } = useAccount();
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // 初始化編輯名稱
  useEffect(() => {
    if (name) {
      setEditName(name);
    }
  }, [name]);

  // 開始編輯
  const handleStartEdit = () => {
    setEditName(name || '');
    setIsEditing(true);
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setEditName(name || '');
    setIsEditing(false);
  };

  // 儲存編輯
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      message.error('請輸入姓名');
      return;
    }
    if (editName.length > 50) {
      message.error('姓名不能超過 50 個字元');
      return;
    }
    try {
      const updatedProfile = await updateProfile({ name: editName.trim() });
      // 更新 Redux store - 需要轉換格式以符合 store 中的 user 格式
      if (updatedProfile) {
        const userData = {
          ...updatedProfile,
          picture: updatedProfile.avatar || picture,
        };
        dispatch(setUser(userData));
      }
      setIsEditing(false);
    } catch (error) {
      console.error('更新個人資料失敗:', error);
    }
  };

  return (
    <div>
      <div className='flex flex-col gap-md'>
        {/* 大頭貼 */}
        <div className='flex items-start gap-xs'>
          <div className='text-sm text-gray-500'>大頭貼：</div>
          <Avatar
            size={64}
            src={picture}
            icon={<UserOutlined />}
          />
        </div>

        {/* 名稱 */}
        <div className='flex items-center gap-xs'>
          <div className='text-sm text-gray-500'>名稱：</div>
          {isEditing ? (
            <Space>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onPressEnter={handleSaveEdit}
                style={{ width: 200 }}
                maxLength={50}
                autoFocus
              />
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleSaveEdit}
                loading={loading}
                size="small"
              />
              <Button
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
                size="small"
              />
            </Space>
          ) : (
            <Space>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                {name || '-'}
              </div>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={handleStartEdit}
                size="small"
              />
            </Space>
          )}
        </div>

        {/* 信箱 */}
        <div className='flex items-center gap-xs'>
          <div className='text-sm text-gray-500'>信箱：</div>
          <div className='text-sm text-gray-500'>
            {email || '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
