import React, { useMemo } from 'react';
import { Card, Tag, Table, Spin, Empty, Tooltip, message } from 'antd';
import { Pie } from '@ant-design/plots';
import { ExclamationCircleFilled, WarningOutlined } from '@ant-design/icons';
import PerfectScrollbar from 'react-perfect-scrollbar';
import SymbolCategoryCell from './SymbolCategoryCell';

const fmtMoney = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 億`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)} 萬`;
  return Number(n).toLocaleString();
};

const fmtPct = (r, digits = 1) => {
  if (r === null || r === undefined) return '—';
  return `${(r * 100).toFixed(digits)}%`;
};

/**
 * AntD preset color name → CSS color (粗略對應，用在 pie chart fill)
 */
const TAG_COLOR_HEX = {
  red: '#cf1322',
  orange: '#d4380d',
  gold: '#d4b106',
  lime: '#7cb305',
  green: '#389e0d',
  cyan: '#08979c',
  blue: '#0958d9',
  geekblue: '#1d39c4',
  purple: '#531dab',
  magenta: '#c41d7f',
};
const UNCLASSIFIED_COLOR = '#bfbfbf';

const AllocationView = ({
  data,
  loading,
  error,
  categories,
  setSymbolCategory,
  onRefetch,
}) => {
  const totalAssets = data?.totalAssets ?? 0;
  const cashBalance = data?.cashBalance ?? 0;
  const positionsValue = data?.positionsValue ?? 0;
  const cats = useMemo(() => data?.categories ?? [], [data]);
  const unclassified = data?.unclassified;
  const unclassifiedSymbols = useMemo(() => unclassified?.symbols ?? [], [unclassified]);

  const hasHoldings = positionsValue > 0 || cashBalance > 0;

  const summary = useMemo(() => {
    const assigned = cats.reduce((s, c) => s + c.symbolCount, 0);
    const targetSum = cats.reduce((s, c) => s + (c.targetRatio || 0), 0);
    return {
      assigned,
      unclassifiedCount: unclassifiedSymbols.length,
      targetSum,
    };
  }, [cats, unclassifiedSymbols]);

  // 圓餅資料：各族群市值 + 未分類 + 現金
  const pieData = useMemo(() => {
    const items = cats
      .filter((c) => c.marketValue > 0)
      .map((c) => ({
        type: c.name,
        value: c.marketValue,
        color: TAG_COLOR_HEX[c.color] || '#888',
      }));
    if (unclassified?.marketValue > 0) {
      items.push({
        type: '未分類',
        value: unclassified.marketValue,
        color: UNCLASSIFIED_COLOR,
      });
    }
    if (cashBalance > 0) {
      items.push({
        type: '現金',
        value: cashBalance,
        color: '#d9d9d9',
      });
    }
    return items;
  }, [cats, unclassified, cashBalance]);

  const tableColumns = [
    {
      title: '族群',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Tag color={record.color} style={{ margin: 0, padding: '1px 10px', borderRadius: 4 }}>
          {name}
        </Tag>
      ),
    },
    {
      title: '檔數',
      dataIndex: 'symbolCount',
      key: 'symbolCount',
      width: 70,
      align: 'right',
      render: (n) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: n > 0 ? 'inherit' : '#bbb' }}>
          {n}
        </span>
      ),
    },
    {
      title: '市值',
      dataIndex: 'marketValue',
      key: 'marketValue',
      width: 110,
      align: 'right',
      render: (v) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: v > 0 ? 'inherit' : '#bbb' }}>
          {fmtMoney(v)}
        </span>
      ),
    },
    {
      title: '實際',
      dataIndex: 'actualRatio',
      key: 'actualRatio',
      width: 80,
      align: 'right',
      render: (r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPct(r)}</span>
      ),
    },
    {
      title: '目標',
      dataIndex: 'targetRatio',
      key: 'targetRatio',
      width: 80,
      align: 'right',
      render: (r) =>
        r === null || r === undefined ? (
          <span style={{ color: '#ccc' }}>未設</span>
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPct(r)}</span>
        ),
    },
    {
      title: '差額',
      dataIndex: 'deltaRatio',
      key: 'deltaRatio',
      width: 90,
      align: 'right',
      render: (d) => {
        if (d === null || d === undefined) return <span style={{ color: '#ccc' }}>—</span>;
        const over = d > 0.001;
        const under = d < -0.001;
        const color = over ? '#cf1322' : under ? '#0958d9' : '#888';
        const sign = d > 0 ? '+' : '';
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color }}>
            {sign}{fmtPct(d)}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Empty description="載入失敗，請稍後再試" />;
  }

  if (!hasHoldings && cats.length === 0) {
    return (
      <Empty description="尚未建立族群、也沒有持股資料" />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 摘要 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <SummaryCell label="總資產" value={`$${fmtMoney(totalAssets)}`} sub={`持倉 + 現金`} />
        <SummaryCell label="持倉市值" value={`$${fmtMoney(positionsValue)}`} sub={`${fmtPct(positionsValue / (totalAssets || 1))}`} />
        <SummaryCell label="已分配" value={`${summary.assigned} 檔`} sub={`族群 ${cats.length} 個`} />
        <SummaryCell
          label="未分類"
          value={`${summary.unclassifiedCount} 檔`}
          sub={summary.unclassifiedCount > 0 ? `$${fmtMoney(unclassified.marketValue)}` : '—'}
          warn={summary.unclassifiedCount > 0}
        />
      </div>

      {/* 目標佔比合計提醒 */}
      {summary.targetSum > 0 && Math.abs(summary.targetSum - 1) > 0.001 && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: 4,
            fontSize: 13,
            color: '#874d00',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ExclamationCircleFilled style={{ color: '#faad14' }} />
          目標佔比合計 <b>{fmtPct(summary.targetSum)}</b>
          ，建議調整至 100%（差 {fmtPct(Math.abs(1 - summary.targetSum))}）
        </div>
      )}

      {/* 圖 + 表 */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        <Card size="small" title="資產分配" styles={{ body: { padding: 12 } }}>
          {pieData.length > 0 ? (
            <Pie
              data={pieData}
              angleField="value"
              colorField="type"
              scale={{
                color: {
                  range: pieData.map((d) => d.color),
                },
              }}
              radius={0.9}
              innerRadius={0.55}
              legend={{
                color: {
                  position: 'bottom',
                  layout: { justifyContent: 'center' },
                  itemMarker: 'circle',
                },
              }}
              tooltip={{
                items: [
                  {
                    field: 'value',
                    name: '市值',
                    valueFormatter: (v) =>
                      `$${Number(v).toLocaleString()}（${fmtPct(v / (totalAssets || 1))}）`,
                  },
                ],
              }}
              label={false}
              height={280}
              autoFit={true}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚無持倉資料" />
          )}
        </Card>

        <Card size="small" title="族群比例對照" styles={{ body: { padding: 0 } }}>
          {cats.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未建立族群" />
            </div>
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={cats}
              columns={tableColumns}
              pagination={false}
              tableLayout="auto"
              summary={() =>
                summary.unclassifiedCount > 0 ? (
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0}>
                      <Tag style={{ margin: 0, padding: '1px 10px', borderRadius: 4 }}>未分類</Tag>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {summary.unclassifiedCount}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(unclassified.marketValue)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtPct(unclassified.actualRatio)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <span style={{ color: '#ccc' }}>—</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <span style={{ color: '#ccc' }}>—</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null
              }
            />
          )}
        </Card>
      </div>

      {/* 未分類持股 */}
      {unclassifiedSymbols.length > 0 && (
        <Card
          size="small"
          title={
            <span>
              <WarningOutlined style={{ color: '#faad14', marginRight: 6 }} />
              未分類持股
              <span style={{ marginLeft: 8, color: '#888', fontSize: 12, fontWeight: 'normal' }}>
                {unclassifiedSymbols.length} 檔 · $
                {fmtMoney(unclassified.marketValue)}（{fmtPct(unclassified.actualRatio)}）
              </span>
            </span>
          }
          styles={{ body: { padding: 0 } }}
        >
          <PerfectScrollbar style={{ maxHeight: 300 }}>
            <Table
              rowKey="symbol"
              size="small"
              dataSource={unclassifiedSymbols}
              pagination={false}
              tableLayout="auto"
              columns={[
                {
                  title: '股號',
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 100,
                  render: (s) => <span style={{ fontWeight: 500 }}>{s}</span>,
                },
                {
                  title: '股數',
                  dataIndex: 'shares',
                  key: 'shares',
                  width: 100,
                  align: 'right',
                  render: (n) => (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {Number(n).toLocaleString()}
                    </span>
                  ),
                },
                {
                  title: '最新價',
                  dataIndex: 'price',
                  key: 'price',
                  width: 100,
                  align: 'right',
                  render: (p) =>
                    p === null ? (
                      <span style={{ color: '#ccc' }}>—</span>
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>${p.toFixed(2)}</span>
                    ),
                },
                {
                  title: '市值',
                  dataIndex: 'value',
                  key: 'value',
                  width: 120,
                  align: 'right',
                  render: (v) => (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(v)}</span>
                  ),
                },
                {
                  title: '設定族群',
                  key: 'assign',
                  width: 140,
                  render: (_, record) => (
                    <SymbolCategoryCell
                      symbol={record.symbol}
                      categoryId={null}
                      categories={categories}
                      onSelect={async (sym, catId) => {
                        const res = await setSymbolCategory(sym, catId);
                        if (!res?.err) {
                          message.success('已歸類');
                          onRefetch?.();
                        }
                        return res;
                      }}
                    />
                  ),
                },
              ]}
            />
          </PerfectScrollbar>
        </Card>
      )}
    </div>
  );
};

const SummaryCell = ({ label, value, sub, warn = false }) => (
  <Card size="small" styles={{ body: { padding: 12 } }}>
    <div style={{ color: warn ? '#faad14' : '#888', fontSize: 12, marginBottom: 4 }}>{label}</div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 600,
        color: warn ? '#faad14' : 'inherit',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    <div style={{ color: '#aaa', fontSize: 12, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
      {sub}
    </div>
  </Card>
);

export default AllocationView;
