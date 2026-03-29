import React from 'react';
import { Card, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useDispatch } from 'react-redux';
import { to } from 'await-to-js';
import { userAPI } from '@/api/api_user';
import { loginSuccess } from '@/store/authSlice';
import { FcGoogle } from 'react-icons/fc';
import { BarChartOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';

const { Title, Text } = Typography;

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { theme } = useTheme();

  // Google 登入成功後處理
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse.credential) {
        message.error('Google 登入失敗，沒有取得憑證');
        return;
      }

      const [error, response] = await to(
        userAPI.googleLogin({ credential: credentialResponse.credential })
      );

      if (error) {
        message.error(error.msg || 'Google 登入失敗');
        return;
      }

      console.log('登入響應:', response);

      // 後端回傳的格式建議跟一般 login 一樣 { accessToken, user }
      // 注意：經過 request.js 攔截器處理後，response 已經是 response.data.data
      const accessToken = response.accessToken || response.access_token || response.token;
      const user = response.user;

      if (!accessToken) {
        console.error('登入響應中沒有 accessToken:', response);
        message.error('登入失敗：無法取得 access token');
        return;
      }

      if (!user) {
        console.error('登入響應中沒有 user:', response);
        message.error('登入失敗：無法取得使用者資料');
        return;
      }

      sessionStorage.setItem('access_token', accessToken);
      dispatch(loginSuccess({ user }));
      message.success('Google 登入成功！');
      
      // 稍微延遲一下，確保 token 已經設置
      setTimeout(() => {
        navigate('/trades');
      }, 100);
    } catch (err) {
      console.error(err);
      message.error('Google 登入異常');
    }
  };

  const handleGoogleError = () => {
    message.error('Google 登入失敗，請再試一次');
  };

  return (
    <div className="auth-container">
      {/* 背景裝飾 */}
      <div className="auth-background">
        <div 
          className="auth-background-gradient"
          style={{
            background: theme.gradient, // 動態設定漸層背景
          }}
        ></div>
        <div className="auth-background-pattern"></div>
      </div>

      {/* 主要內容 */}
      <div className="auth-content-wrapper">
        <Card className="login-card">
          {/* Logo 區域 */}
          <div className="auth-logo-section">
            <div 
              className="auth-logo-icon"
              style={{
                background: theme.gradient, // 動態設定漸層背景
              }}
            >
              <BarChartOutlined />
            </div>
            <Title 
              level={1} 
              className="auth-brand-title"
              style={{
                background: theme.gradient, // 動態設定漸層背景
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Trado
            </Title>
            <Text className="auth-brand-subtitle">
              專業交易記錄管理平台
            </Text>
          </div>

          {/* 登入區域 */}
          <div className="auth-login-section">
            <Title level={3} className="auth-welcome-title">
              歡迎回來
            </Title>
            <Text type="secondary" className="auth-welcome-subtitle">
              使用 Google 帳號快速登入，開始管理您的交易記錄
            </Text>

            <div className="google-login-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          </div>

          {/* 頁尾 */}
          <div className="auth-footer">
            <Text type="secondary" className="auth-footer-text">
              登入即表示您同意我們的
              <a href="#" className="auth-link">服務條款</a>
              {' '}與{' '}
              <a href="#" className="auth-link">隱私政策</a>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
