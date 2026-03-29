import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/api/api_user';
import { to } from 'await-to-js';
import { userAPI } from '../../api/api_user';
import { useDispatch } from 'react-redux';
import { loginSuccess, loginFailure, loginStart } from '@store/authSlice';


const { Title, Text } = Typography;

const Register = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    setLoading(true);
    // 準備註冊資料（使用 JSON 格式而不是 FormData）
    const registerData = {
      name: values.username,
      email: values.email,
      password: values.password,
    };
    // call api
    const [error, response] = await to(register(registerData));
    
    if (error) {
      message.error(error.message);
      // 更新 Redux 錯誤狀態
      dispatch(loginFailure(error.msg || error.message || '註冊失敗'));

      return;
    }
    setLoading(false);

    // 登入成功，更新 Redux 狀態
    dispatch(loginSuccess({
      user: response.user,
    }));

    // 儲存 token 到 sessionStorage
    sessionStorage.setItem('access_token', response.accessToken);
    
    // 轉到交易頁面
    navigate('/trades');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Card className="register-card">
          <div className="auth-header">
            <Title level={2} className="auth-title">
              建立帳號
            </Title>
            <Text type="secondary">
              歡迎加入我們！請填寫以下資訊完成註冊
            </Text>
          </div>

          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            layout="vertical"
            // size="large"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              className='mb-sm'
              label="使用者名稱"
              rules={[
                { required: true, message: '請輸入使用者名稱' },
                { min: 2, message: '使用者名稱至少 2 個字元' },
                { max: 20, message: '使用者名稱最多 20 個字元' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="請輸入使用者名稱"
                className="auth-input"
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="電子信箱"
              className='mb-sm'
              rules={[
                { required: true, message: '請輸入電子信箱' },
                { type: 'email', message: '請輸入有效的電子信箱格式' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="請輸入電子信箱"
                className="auth-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密碼"
              className='mb-sm'
              rules={[
                { required: true, message: '請輸入密碼' },
                { min: 8, message: '密碼至少 8 個字元' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: '密碼必須包含大小寫字母和數字'
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="請輸入密碼"
                className="auth-input"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="確認密碼"
              dependencies={['password']}
              rules={[
                { required: true, message: '請確認密碼' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('兩次輸入的密碼不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="請再次輸入密碼"
                className="auth-input"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="auth-button"
                loading={loading}
                block
              >
                註冊
              </Button>
            </Form.Item>
          </Form>

          <Divider>
            <Text type="secondary">或</Text>
          </Divider>

          <div className="auth-footer">
            <Text type="secondary">
              已有帳號？{' '}
              <Link to="/login" className="auth-link">
                立即登入
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;