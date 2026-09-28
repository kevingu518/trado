import React, { useState } from 'react';
import { Segmented, Button, Space, Alert, Empty, Spin } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useAIAnalysis } from '../hooks/useAIAnalysis';

const PERIOD_OPTIONS = [
  { label: '近一個月', value: 'month' },
  { label: '近三個月', value: '3months' },
];

const AnalysisPanel = () => {
  const [period, setPeriod] = useState('month');
  const { content, loading, error, run, stop } = useAIAnalysis();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div className="useBetween">
        <Segmented
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          disabled={loading}
        />
        {loading ? (
          <Button danger onClick={stop}>
            停止
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => run(period)}
          >
            開始分析
          </Button>
        )}
      </div>

      {error && (
        <Alert type="error" showIcon message={error} />
      )}

      <div
        className="ai-analysis-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 8,
          padding: content || loading ? 16 : 0,
          lineHeight: 1.7,
        }}
      >
        {content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : loading ? (
          <Space>
            <Spin size="small" />
            <span style={{ color: '#888' }}>分析中…</span>
          </Space>
        ) : (
          <Empty
            image={<RobotOutlined style={{ fontSize: 48, color: '#bbb' }} />}
            description="選擇期間後點「開始分析」，AI 會解讀你這段期間的交易行為與紀律"
            style={{ marginTop: 48 }}
          />
        )}
        {content && loading && <span className="ai-cursor">▍</span>}
      </div>
    </div>
  );
};

export default AnalysisPanel;
