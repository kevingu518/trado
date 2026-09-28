import React, { useState, useEffect } from 'react';
import { Form, Select, Input, Button, Space, Tag, message, Typography, Alert, Row, Col, Descriptions, Divider } from 'antd';
import { RobotOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { useAISettings } from '../hooks/useAISettings';

const { Paragraph, Text } = Typography;

const AISettings = () => {
  const { settings, loading, saving, save, clearKey, test } = useAISettings();

  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, model, latencyMs } | { ok:false, msg }

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setModel(settings.model || '');
    }
  }, [settings]);

  const providers = settings?.providers || [];
  const selectedCfg = providers.find((p) => p.value === provider);
  const providerChanged = settings && provider !== settings.provider;
  const effectiveModel = (model && model.trim()) || selectedCfg?.defaultModel || '-';

  const handleProviderChange = (value) => {
    setProvider(value);
    const cfg = providers.find((p) => p.value === value);
    setModel(cfg?.defaultModel || '');
    setApiKey('');
    setTestResult(null);
  };

  const handleSave = async () => {
    if (providerChanged && !apiKey.trim()) {
      message.warning('切換供應商後，請一併填入該供應商的 API key');
      return;
    }
    const payload = { provider, model: model.trim() };
    if (apiKey.trim()) payload.api_key = apiKey.trim();

    const { err } = await save(payload);
    if (err) {
      message.error(err.msg || err.message || '儲存失敗');
      return;
    }
    setApiKey('');
    message.success('AI 設定已儲存');
  };

  const handleClear = async () => {
    const { err } = await clearKey();
    if (err) {
      message.error(err.msg || err.message || '清除失敗');
      return;
    }
    setApiKey('');
    setTestResult(null);
    message.success('已清除 API key');
  };

  const handleTest = async () => {
    if (!apiKey.trim() && !settings?.hasKey) {
      message.warning('請先填入或儲存 API key 再測試');
      return;
    }
    setTesting(true);
    setTestResult(null);
    // 有輸入金鑰就測輸入的（存檔前先驗證），否則測已存的
    const payload = { provider, model: model.trim() || undefined };
    if (apiKey.trim()) payload.api_key = apiKey.trim();
    const { err, data } = await test(payload);
    setTesting(false);
    if (err) {
      setTestResult({ ok: false, msg: err.msg || err.message || '連線失敗' });
      return;
    }
    setTestResult({ ok: true, model: data.model, latencyMs: data.latencyMs });
  };

  return (
    <Row gutter={[32, 24]}>
      {/* 左：輸入 */}
      <Col xs={24} md={13}>
        <Paragraph type="secondary">
          填入你的 AI 供應商 API key 後，即可在交易頁用 AI 分析交易紀錄。
          金鑰會加密儲存於後端，所有呼叫都經由伺服器，不會外流到瀏覽器。
        </Paragraph>

        <Form layout="vertical" disabled={loading || saving}>
          <Form.Item label="AI 供應商">
            <Select
              value={provider}
              onChange={handleProviderChange}
              options={providers.map((p) => ({
                value: p.value,
                label: (
                  <span>
                    {p.label}
                    {!p.stable && <Tag color="orange" style={{ marginLeft: 8 }}>實驗性</Tag>}
                  </span>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item label="模型" help="留空會使用該供應商的預設模型">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={selectedCfg?.defaultModel}
            />
          </Form.Item>

          <Form.Item label="API key">
            <Input.Password
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder={settings?.hasKey ? '留空＝不變更，輸入則覆蓋' : '貼上你的 API key'}
              autoComplete="off"
            />
          </Form.Item>

          {providerChanged && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="你切換了供應商，請填入新供應商對應的 API key 再儲存。"
            />
          )}

          <Space>
            <Button type="primary" icon={<RobotOutlined />} loading={saving} onClick={handleSave}>
              儲存設定
            </Button>
            <Button icon={<ApiOutlined />} loading={testing} onClick={handleTest}>
              測試連線
            </Button>
            {settings?.hasKey && (
              <Button danger loading={saving} onClick={handleClear}>
                清除金鑰
              </Button>
            )}
          </Space>
        </Form>
      </Col>

      {/* 右：輔助資訊 */}
      <Col xs={24} md={11}>
        <Descriptions
          title="目前設定"
          column={1}
          size="small"
          bordered
          styles={{ label: { width: 110 } }}
        >
          <Descriptions.Item label="供應商">
            {selectedCfg?.label || '-'}
            {selectedCfg && !selectedCfg.stable && <Tag color="orange" style={{ marginLeft: 8 }}>實驗性</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="使用模型">
            <Text code>{effectiveModel}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="金鑰狀態">
            {settings?.hasKey ? (
              <Tag color="green">已設定 {settings.keyMask}</Tag>
            ) : (
              <Tag color="default">未設定</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="預估費用">
            {selectedCfg?.pricing ? (
              <div>
                <div>單次分析約 <Text strong>${selectedCfg.estPerRunUSD}</Text> <Text type="secondary">(估)</Text></div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  輸入 ${selectedCfg.pricing.input} / 輸出 ${selectedCfg.pricing.output}（每 1M token）
                </Text>
              </div>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="申請金鑰">
            {selectedCfg?.docsUrl ? (
              <a href={selectedCfg.docsUrl} target="_blank" rel="noreferrer">
                前往申請 <LinkOutlined />
              </a>
            ) : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }} />

        <div>
          <Text strong>連線測試</Text>
          <div style={{ marginTop: 8 }}>
            {testing ? (
              <Text type="secondary">測試中…</Text>
            ) : testResult ? (
              testResult.ok ? (
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message={`連線成功（${testResult.model}，${testResult.latencyMs}ms）`}
                />
              ) : (
                <Alert type="error" showIcon icon={<CloseCircleOutlined />} message={testResult.msg} />
              )
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                按「測試連線」可在儲存前先驗證金鑰與模型是否可用。
              </Text>
            )}
          </div>
        </div>
      </Col>
    </Row>
  );
};

export default AISettings;
