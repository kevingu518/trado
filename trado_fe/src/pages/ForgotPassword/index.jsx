import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Divider, message, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 這裡添加忘記密碼 API 調用
      console.log('忘記密碼資料:', values);
      
      // 模擬 API 調用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUserEmail(values.email);
      setEmailSent(true);
      message.success('重設密碼連結已發送到您的信箱');
    } catch (error) {
      message.error('發送失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (emailSent) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <Card className="forgot-password-card">
            <Result
              status="success"
              title="重設密碼連結已發送"
              subTitle={`我們已將重設密碼的連結發送到 ${userEmail}`}
              extra={[
                <Button
                  key="back"
                  type="primary"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBackToLogin}
                  className="auth-button"
                >
                  返回登入
                </Button>
              ]}
            />
            
            <Divider />
            
            <div className="auth-footer">
              <Text type="secondary">
                沒有收到信件？{' '}
                <Link to="/forgot-password" className="auth-link">
                  重新發送
                </Link>
              </Text>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Card className="forgot-password-card">
          <div className="auth-header">
            <Title level={2} className="auth-title">
              忘記密碼
            </Title>
            <Text type="secondary">
              請輸入您的電子信箱，我們將發送重設密碼的連結給您
            </Text>
          </div>

          <Form
            form={form}
            name="forgotPassword"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="電子信箱"
              rules={[
                { required: true, message: '請輸入電子信箱' },
                { type: 'email', message: '請輸入有效的電子信箱格式' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="請輸入您的電子信箱"
                className="auth-input"
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
                發送重設連結
              </Button>
            </Form.Item>
          </Form>

          <Divider>
            <Text type="secondary">或</Text>
          </Divider>

          <div className="auth-footer">
            <Text type="secondary">
              想起密碼了？{' '}
              <Link to="/login" className="auth-link">
                返回登入
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;