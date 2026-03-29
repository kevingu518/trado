import { createSlice } from '@reduxjs/toolkit';
// import { authApi } from '../api/authApi'; // 你的 axios 封裝

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 登入成功
    loginSuccess: (state, action) => {
      console.log({action})
      const { user } = action.payload;
      state.user = user;
      state.isAuthenticated = true;
      state.error = null;
      state.isLoading = false;
    },
    
    // 登入失敗
    loginFailure: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    
    // 開始登入
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    
    // 登出
    logout: (state) => {
      console.log("in logout slice")
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    
    // 更新 token
    updateTokens: (state, action) => {
      const { accessToken, refreshToken } = action.payload;
    },
    
    // 清除錯誤
    clearError: (state) => {
      state.error = null;
    },
    
    // 設定使用者資料
    setUser: (state, action) => {
      state.user = action.payload;
    },
  },
});

export const {
  loginSuccess,
  loginFailure,
  loginStart,
  logout,
  updateTokens,
  clearError,
  setUser,
} = authSlice.actions;

export default authSlice.reducer;