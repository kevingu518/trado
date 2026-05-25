// ProtectedRoute.jsx
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

const ProtectedRoute = memo(({ children }) => {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const isLoading = useSelector(state => state.auth.isLoading);
  const isRehydrated = useSelector(state => state._persist?.rehydrated);
  const location = useLocation();
  
  // 如果 persist 還沒完成重新水合，顯示載入狀態
  if (!isRehydrated || isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // 檢查 token 是否存在且有效
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return children;
});

ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;