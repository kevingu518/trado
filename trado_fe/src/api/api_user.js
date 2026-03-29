import request from './request';

export const userAPI = {
  // google login
  googleLogin: (data) => 
    request.post('/auth/google-login', data),
  
  // 取得使用者列表
  getUsers: (params = {}) => 
    request.get('/users', { params }),
  
  // 取得特定使用者
  getUser: (userId) => 
    request.get(`/users/${userId}`),
  
  // 註冊 建立使用者
  createUser: (data) => 
    request.post('/register', data),
  
  // 更新使用者
  updateUser: (userId, userData) => 
    request.put(`/users/${userId}`, userData),
  
  // 刪除使用者
  deleteUser: (userId) => 
    request.delete(`/users/${userId}`),
  
  // 上傳使用者頭像
  uploadAvatar: (userId, file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request.upload(`/users/${userId}/avatar`, formData);
  },
  
  // 取得使用者統計
  getUserStats: (userId) => 
    request.get(`/users/${userId}/stats`),
  
  // 啟用/停用使用者
  toggleUserStatus: (userId, isActive) => 
    request.patch(`/users/${userId}/status`, { isActive }),
  
  // 重設使用者密碼
  resetUserPassword: (userId, newPassword) => 
    request.post(`/users/${userId}/reset-password`, { newPassword }),
};

// 註冊
export const register = (data) => {
  return request.post('/auth/register', data);
};
// 登入
export const login = (data) => {
  return request.post('/auth/login', data);
};
// 登出
export const logout = () => {
  return request.post('/auth/logout');
};
