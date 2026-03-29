import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi'; // 你的 axios 封裝
import {
  loginSuccess,
  loginFailure,
  loginStart,
  logout,
  updateTokens,
  clearError,
  setUser,
} from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user, isAuthenticated, isLoading, error } = useSelector(state => state.auth);

  const login = async (credentials) => {
    try {
      dispatch(loginStart());
      
      const response = await authApi.login(credentials);
      
      if (response.success) {
        dispatch(loginSuccess(response.data));
        
        // 導航到原本要去的頁面或儀表板
        const from = location.state?.from?.pathname || '/app/dashboard';
        navigate(from);
        
        return response.data;
      } else {
        dispatch(loginFailure(response.message));
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(loginFailure(error.message));
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authApi.register(userData);
      
      if (response.success) {
        navigate('/login');
        return response.data;
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      // 呼叫登出 API
      await authApi.logout();
    } catch (error) {
      console.error('登出 API 失敗:', error);
    } finally {
      // 無論 API 成功與否，都清除本地狀態
      dispatch(logout());
      navigate('/login');
    }
  };

  const refreshToken = async () => {
    try {
      const { refreshToken: currentRefreshToken } = useSelector(state => state.auth);
      
      if (!currentRefreshToken) {
        throw new Error('沒有 refresh token');
      }

      const response = await authApi.refreshToken(currentRefreshToken);
      
      if (response.success) {
        dispatch(updateTokens(response.data));
        return response.data;
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      // 刷新失敗，登出用戶
      dispatch(logout());
      navigate('/login');
      throw error;
    }
  };

  const getProfile = async () => {
    try {
      const response = await authApi.getProfile();
      
      if (response.success) {
        dispatch(setUser(response.data));
        return response.data;
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      throw error;
    }
  };

  const clearAuthError = () => {
    dispatch(clearError());
  };

  return {
    // 狀態
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // 方法
    login,
    register,
    logout: logoutUser,
    refreshToken,
    getProfile,
    clearAuthError,
  };
};