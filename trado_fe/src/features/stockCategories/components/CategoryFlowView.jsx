import React, { useMemo, useState } from 'react';
import { Card, Table, Segmented, Spin, Empty, Alert, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Pie, Sankey } from '@ant-design/plots';
import { useThemePalette } from '../hooks/useThemePalette';
import { useAllocationFlow } from '../hooks/useAllocationFlow';
import CategoryTag from './CategoryTag';

const UNCLASSIFIED_KEY = '__unclassified__';
const UNCLASSIFIED_COLOR = '#bfbfbf';
const POOL_NODE = '資金池';
const nodeKey = (d) => d?.key ?? d?.name ?? d?.id;

const fmtMoney = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 億`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)} 萬`;
  return Number(Math.round(n)).toLocaleString();
};
const fmtPct = (r, digits = 1) => {
  if (r === null || r === undefined) return '—';
  return `${(r * 100).toFixed(digits)}%`;
};

const FlowStat = ({ label, value, sub, valueColor }) => (
  <div>
    <div style={{ color: '#999', fontSize: 12, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: valueColor || 'inherit', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
      {value}
    </div>
    {sub != null && (
      <div style={{ color: '#bbb', fontSize: 12, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>
    )}
  </div>
);

const CategoryFlowView = () => {
  const { getHex } = useThemePalette();
  const { data, loading, error } = useAllocationFlow();
  const [mode, setMode] = useState('pie'); // 'pie' | 'sankey'

  const previous = data?.previous ?? null;
  const current = data?.current ?? null;

  const colorOf = (snapCat) => getHex(snapCat.color);

  // 單一快照 → 圓餅資料
  const toPieData = useMemo(() => (snap) => {
    if (!snap) return [];
    const items = (snap.categories || [])
      .filter((c) => c.cost > 0)
      .map((c) => ({ type: c.name, value: c.cost, color: colorOf(c) }));
    if (snap.unclassified?.cost > 0) {
      items.push({ type: '未分類', value: snap.unclassified.cost, color: UNCLASSIFIED_COLOR });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getHex]);

  const prevPie = useMemo(() => toPieData(previous), [toPieData, previous]);
  const currPie = useMemo(() => toPieData(current), [toPieData, current]);

  // 成本 vs 市值：最新持倉各族群的成本佔比、市值佔比、浮盈虧
  // 浮盈虧只以「有報價部位」的成本（valuedCost）為基準，與後端一致
  const valueRows = useMemo(() => {
    if (!current) return [];
    const toRow = (c, key, name, palette, color) => {
      const valuedCost = c.valuedCost || 0;
      const marketValue = c.marketValue || 0;
      const pnl = marketValue - valuedCost;
      return {
        key, name, palette, color,
        costRatio: c.ratio || 0,
        marketRatio: c.marketRatio || 0,
        valuedCost, marketValue, pnl,
        pnlRatio: valuedCost > 0 ? pnl / valuedCost : null,
      };
    };
    const arr = (current.categories || [])
      .filter((c) => c.cost > 0)
      .map((c) => toRow(c, c.id, c.name, c.color, colorOf(c)));
    const u = current.unclassified;
    if (u && u.cost > 0) {
      arr.push(toRow(u, UNCLASSIFIED_KEY, '未分類', null, UNCLASSIFIED_COLOR));
    }
    return arr.sort((a, b) => b.marketValue - a.marketValue || b.costRatio - a.costRatio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, getHex]);

  // 兩快照合併 → 差異列
  const rows = useMemo(() => {
    const map = new Map();
    const addSide = (snap, side) => {
      if (!snap) return;
      for (const c of snap.categories || []) {
        const r = map.get(c.id) || { key: c.id, name: c.name, color: colorOf(c), palette: c.color };
        r[`${side}Cost`] = c.cost;
        r[`${side}Ratio`] = c.ratio;
        map.set(c.id, r);
      }
      if (snap.unclassified?.cost > 0) {
        const r = map.get(UNCLASSIFIED_KEY) || {
          key: UNCLASSIFIED_KEY, name: '未分類', color: UNCLASSIFIED_COLOR, palette: null,
        };
        r[`${side}Cost`] = snap.unclassified.cost;
        r[`${side}Ratio`] = snap.unclassified.ratio;
        map.set(UNCLASSIFIED_KEY, r);
      }
    };
    addSide(previous, 'prev');
    addSide(current, 'curr');
    return [...map.values()]
      .map((r) => {
        const prevCost = r.prevCost || 0;
        const currCost = r.currCost || 0;
        const prevRatio = r.prevRatio || 0;
        const currRatio = r.currRatio || 0;
        return {
          ...r, prevCost, currCost, prevRatio, currRatio,
          deltaCost: currCost - prevCost,
          deltaRatio: currRatio - prevRatio,
        };
      })
      .sort((a, b) => b.currCost - a.currCost || b.prevCost - a.prevCost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previous, current, getHex]);

  // 佔比流向 Sankey：左=上次族群、右=現在族群，含「資金流入/釋出」合成節點
  const { snapshotData, snapshotColorMap } = useMemo(() => {
    const INFLOW = '資金流入';
    const OUTFLOW = '資金釋出';
    const links = [];
    const colorMap = { [INFLOW]: '#52c41a', [OUTFLOW]: '#bfbfbf' };
    if (previous && current) {
      for (const r of rows) {
        const left = `上次·${r.name}`;
        const right = `現在·${r.name}`;
        colorMap[left] = r.color;
        colorMap[right] = r.color;
        const carried = Math.min(r.prevCost, r.currCost);
        if (carried > 0) links.push({ source: left, target: right, value: carried });
        const growth = r.currCost - r.prevCost;
        if (growth > 0) links.push({ source: INFLOW, target: right, value: growth });
        const shrink = r.prevCost - r.currCost;
        if (shrink > 0) links.push({ source: left, target: OUTFLOW, value: shrink });
      }
    }
    return { snapshotData: links, snapshotColorMap: colorMap };
  }, [rows, previous, current]);

  // 資金輪動：最新交易日 賣出族群 → 資金池 → 買進族群（依當日成交額）
  const { rotationData, rotationColorMap } = useMemo(() => {
    const links = [];
    const colorMap = { [POOL_NODE]: '#9aa4b2' };
    const rot = data?.rotation;
    if (rot) {
      for (const s of rot.sells || []) {
        const node = `賣出·${s.name}`;
        colorMap[node] = s.color ? getHex(s.color) : UNCLASSIFIED_COLOR;
        links.push({ source: node, target: POOL_NODE, value: s.amount });
      }
      for (const b of rot.buys || []) {
        const node = `買進·${b.name}`;
        colorMap[node] = b.color ? getHex(b.color) : UNCLASSIFIED_COLOR;
        links.push({ source: POOL_NODE, target: node, value: b.amount });
      }
    }
    return { rotationData: links, rotationColorMap: colorMap };
  }, [data, getHex]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>;
  }
  if (error) {
    return <Empty description="載入失敗，請稍後再試" />;
  }
  if (!current || current.totalCost <= 0) {
    return (
      <Empty
        description={
          <span>
            目前沒有可計算的持倉成本
            <br />
            <span style={{ color: '#999', fontSize: 12 }}>
              需有持倉中的部位且已填入股數與均價（或有建倉明細）才能計算族群佔比
            </span>
          </span>
        }
        style={{ padding: '48px 0' }}
      />
    );
  }

  const pieConfig = (pieData) => ({
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    scale: { color: { range: pieData.map((d) => d.color) } },
    radius: 0.9,
    innerRadius: 0.6,
    legend: false,
    tooltip: {
      items: [{
        field: 'value',
        name: '成本',
        valueFormatter: (v) => `$${fmtMoney(v)}`,
      }],
    },
    label: false,
    height: 200,
    autoFit: true,
  });

  const deltaColumns = [
    {
      title: '族群',
      dataIndex: 'name',
      key: 'name',
      render: (name, r) =>
        r.key === UNCLASSIFIED_KEY
          ? <Tag style={{ borderRadius: 4 }}>未分類</Tag>
          : <CategoryTag color={r.palette} size="sm">{name}</CategoryTag>,
    },
    {
      title: '上次佔比',
      dataIndex: 'prevRatio',
      key: 'prevRatio',
      width: 110,
      align: 'right',
      render: (r, row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: row.prevCost > 0 ? 'inherit' : '#bbb' }}>
          {row.prevCost > 0 ? fmtPct(r) : '—'}
        </span>
      ),
    },
    {
      title: '最新佔比',
      dataIndex: 'currRatio',
      key: 'currRatio',
      width: 110,
      align: 'right',
      render: (r, row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: row.currCost > 0 ? 'inherit' : '#bbb' }}>
          {row.currCost > 0 ? fmtPct(r) : '—'}
        </span>
      ),
    },
    {
      title: '佔比變化',
      dataIndex: 'deltaRatio',
      key: 'deltaRatio',
      width: 120,
      align: 'right',
      render: (d) => {
        const up = d > 0.0005;
        const down = d < -0.0005;
        const color = up ? 'var(--color-up)' : down ? 'var(--color-down)' : '#999';
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color }}>
            {up && <ArrowUpOutlined style={{ fontSize: 11, marginRight: 2 }} />}
            {down && <ArrowDownOutlined style={{ fontSize: 11, marginRight: 2 }} />}
            {up ? '+' : ''}{fmtPct(d)}
          </span>
        );
      },
    },
    {
      title: '成本變化',
      dataIndex: 'deltaCost',
      key: 'deltaCost',
      width: 130,
      align: 'right',
      render: (d) => {
        const color = d > 0 ? 'var(--color-up)' : d < 0 ? 'var(--color-down)' : '#999';
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color }}>
            {d > 0 ? '+' : ''}${fmtMoney(d)}
          </span>
        );
      },
    },
  ];

  const dateLabel = (d) => (d ? d : '—');

  // 左側摘要：總持倉成本變化、加碼/減碼合計、最大增減族群
  const totalPrev = previous?.totalCost ?? 0;
  const totalCurr = current?.totalCost ?? 0;
  const totalDelta = totalCurr - totalPrev;
  const addSum = rows.reduce((s, r) => s + (r.deltaCost > 0 ? r.deltaCost : 0), 0);
  const cutSum = rows.reduce((s, r) => s + (r.deltaCost < 0 ? r.deltaCost : 0), 0);
  const topUp = previous ? rows.reduce((a, r) => (!a || r.deltaRatio > a.deltaRatio ? r : a), null) : null;
  const topDown = previous ? rows.reduce((a, r) => (!a || r.deltaRatio < a.deltaRatio ? r : a), null) : null;

  // 成本 vs 市值摘要
  const totalMarketValue = current?.totalMarketValue ?? 0;
  const totalValuedCost = current?.totalValuedCost ?? 0;
  const totalPnl = totalMarketValue - totalValuedCost;
  const totalPnlRatio = totalValuedCost > 0 ? totalPnl / totalValuedCost : null;
  // 有報價部位 < 全部成本 → 有部位拿不到報價，市值統計不完整
  const unpricedCost = totalCurr - totalValuedCost;
  const pnlRows = valueRows.filter((r) => r.pnlRatio !== null);
  const bestPnl = pnlRows.reduce((a, r) => (!a || r.pnlRatio > a.pnlRatio ? r : a), null);
  const worstPnl = pnlRows.reduce((a, r) => (!a || r.pnlRatio < a.pnlRatio ? r : a), null);

  const valueColumns = [
    {
      title: '族群',
      dataIndex: 'name',
      key: 'name',
      render: (name, r) =>
        r.key === UNCLASSIFIED_KEY
          ? <Tag style={{ borderRadius: 4 }}>未分類</Tag>
          : <CategoryTag color={r.palette} size="sm">{name}</CategoryTag>,
    },
    {
      title: '成本佔比',
      dataIndex: 'costRatio',
      key: 'costRatio',
      width: 110,
      align: 'right',
      render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPct(r)}</span>,
    },
    {
      title: '市值佔比',
      dataIndex: 'marketRatio',
      key: 'marketRatio',
      width: 110,
      align: 'right',
      render: (r, row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: row.marketValue > 0 ? 'inherit' : '#bbb' }}>
          {row.marketValue > 0 ? fmtPct(r) : '—'}
        </span>
      ),
    },
    {
      title: '浮盈虧',
      dataIndex: 'pnlRatio',
      key: 'pnlRatio',
      width: 150,
      align: 'right',
      render: (pr, row) => {
        if (pr === null) return <span style={{ color: '#bbb' }}>—</span>;
        const up = pr > 0.00005;
        const down = pr < -0.00005;
        const color = up ? 'var(--color-up)' : down ? 'var(--color-down)' : '#999';
        return (
          <div style={{ fontVariantNumeric: 'tabular-nums', color, lineHeight: 1.3 }}>
            <div>
              {up && <ArrowUpOutlined style={{ fontSize: 11, marginRight: 2 }} />}
              {down && <ArrowDownOutlined style={{ fontSize: 11, marginRight: 2 }} />}
              {up ? '+' : ''}{fmtPct(pr)}
            </div>
            <div style={{ fontSize: 11, color: '#bbb' }}>
              {row.pnl >= 0 ? '+' : '-'}${fmtMoney(Math.abs(row.pnl))}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: '#666', fontSize: 13 }}>
          {mode === 'rotation' ? (
            data?.rotation?.date ? (
              <>最近交易日 <b>{dateLabel(data?.rotation?.date)}</b> 各族群資金進出（依當日<b>成交額</b>）</>
            ) : (
              <>尚無買賣明細，顯示目前<b>持倉佔比</b>（依持倉成本）</>
            )
          ) : mode === 'value' ? (
            <>最新持倉 <b>{dateLabel(current?.date)}</b> 各族群<b>成本</b>與<b>市值</b>佔比、浮盈虧（以最新收盤價計）</>
          ) : (
            <>以<b>持倉成本</b>計算各族群佔比 ·{' '}
              上次交易日 <b>{dateLabel(previous?.date)}</b> → 最新 <b>{dateLabel(current?.date)}</b></>
          )}
        </div>
        <Segmented
          size="small"
          value={mode}
          onChange={setMode}
          options={[
            { label: '圓餅對照', value: 'pie' },
            { label: '成本/市值', value: 'value' },
            { label: '佔比流向', value: 'snapshot' },
            { label: '資金輪動', value: 'rotation' },
          ]}
        />
      </div>

      {(mode === 'pie' || mode === 'snapshot') && !previous && (
        <Alert
          type="info"
          message="目前只有一個交易日的資料，尚無法比較佔比變化。等下一次交易後即可看到。"
          banner
        />
      )}

      {mode === 'pie' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          {/* 左：兩個圓餅擺一起，共用一組圖例 */}
          <Card
            size="small"
            title="持倉佔比對照"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: 12, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 4 }}>
                  上次（{dateLabel(previous?.date)}）
                </div>
                {prevPie.length > 0
                  ? <Pie {...pieConfig(prevPie)} />
                  : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="無資料" style={{ padding: '52px 0' }} />}
              </div>
              <div>
                <div style={{ textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 4 }}>
                  最新（{dateLabel(current?.date)}）
                </div>
                {currPie.length > 0
                  ? <Pie {...pieConfig(currPie)} />
                  : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="無資料" style={{ padding: '52px 0' }} />}
              </div>
            </div>
            {/* 共用圖例 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', marginTop: 12 }}>
              {rows.map((r) => (
                <span key={r.key} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: '#555' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, marginRight: 5 }} />
                  {r.name}
                </span>
              ))}
            </div>

            {/* 摘要：填滿下方空白，錨定在卡片底部 */}
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: previous ? 'repeat(3, 1fr)' : '1fr', gap: 12 }}>
                <FlowStat
                  label="總持倉成本"
                  value={`$${fmtMoney(totalCurr)}`}
                  sub={previous ? `上次 $${fmtMoney(totalPrev)}（${totalDelta >= 0 ? '+' : '-'}$${fmtMoney(Math.abs(totalDelta))}）` : null}
                />
                {previous && <FlowStat label="加碼合計" value={`+$${fmtMoney(addSum)}`} valueColor="var(--color-up)" />}
                {previous && <FlowStat label="減碼合計" value={cutSum < 0 ? `-$${fmtMoney(Math.abs(cutSum))}` : '$0'} valueColor="var(--color-down)" />}
              </div>
              {previous && ((topUp && topUp.deltaRatio > 0.0005) || (topDown && topDown.deltaRatio < -0.0005)) && (
                <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
                  {topUp && topUp.deltaRatio > 0.0005 && (
                    <span>最大增加：<b style={{ color: 'var(--color-up)' }}>{topUp.name}</b> +{fmtPct(topUp.deltaRatio)}</span>
                  )}
                  {topDown && topDown.deltaRatio < -0.0005 && (
                    <span>最大減少：<b style={{ color: 'var(--color-down)' }}>{topDown.name}</b> {fmtPct(topDown.deltaRatio)}</span>
                  )}
                </div>
              )}
            </div>
          </Card>
          {/* 右：族群佔比變化 */}
          <Card
            size="small"
            title="族群佔比變化"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: 0, flex: 1, minHeight: 0, overflow: 'auto' } }}
          >
            <Table
              rowKey="key"
              size="small"
              dataSource={rows}
              columns={deltaColumns}
              pagination={false}
              tableLayout="auto"
              sticky
            />
          </Card>
        </div>
      ) : mode === 'value' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 12, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          {/* 左：持倉損益摘要 */}
          <Card
            size="small"
            title="持倉損益摘要"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FlowStat label="總持倉成本" value={`$${fmtMoney(totalCurr)}`} />
              <FlowStat
                label="總市值"
                value={`$${fmtMoney(totalMarketValue)}`}
                sub={unpricedCost > 0 ? `${fmtMoney(unpricedCost)} 成本無報價，未計入` : null}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <FlowStat
                label="浮盈虧"
                value={totalPnlRatio === null
                  ? '—'
                  : `${totalPnl >= 0 ? '+' : '-'}$${fmtMoney(Math.abs(totalPnl))}`}
                sub={totalPnlRatio === null ? '尚無報價' : `報酬率 ${totalPnl >= 0 ? '+' : ''}${fmtPct(totalPnlRatio)}（以有報價部位成本計）`}
                valueColor={totalPnl > 0 ? 'var(--color-up)' : totalPnl < 0 ? 'var(--color-down)' : 'inherit'}
              />
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#888' }}>
              {bestPnl && (
                <span>最賺族群：<b style={{ color: 'var(--color-up)' }}>{bestPnl.name}</b> {bestPnl.pnlRatio >= 0 ? '+' : ''}{fmtPct(bestPnl.pnlRatio)}</span>
              )}
              {worstPnl && worstPnl.key !== bestPnl?.key && (
                <span>最賠族群：<b style={{ color: 'var(--color-down)' }}>{worstPnl.name}</b> {worstPnl.pnlRatio >= 0 ? '+' : ''}{fmtPct(worstPnl.pnlRatio)}</span>
              )}
            </div>
          </Card>
          {/* 右：成本佔比 / 市值佔比 / 浮盈虧 */}
          <Card
            size="small"
            title="各族群成本 vs 市值"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: 0, flex: 1, minHeight: 0, overflow: 'auto' } }}
          >
            {valueRows.length > 0 ? (
              <Table
                rowKey="key"
                size="small"
                dataSource={valueRows}
                columns={valueColumns}
                pagination={false}
                tableLayout="auto"
                sticky
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="無持倉資料" style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      ) : mode === 'snapshot' ? (
        <Card
          size="small"
          title="佔比流向"
          extra={<span style={{ color: '#999', fontSize: 12 }}>左＝上次 · 右＝最新 · 綠＝新增資金、灰＝釋出（依持倉成本）</span>}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { padding: 12, flex: 1, minHeight: 0, overflow: 'auto' } }}
        >
          {snapshotData.length > 0 ? (
            <Sankey
              data={snapshotData}
              nodeWidthRatio={0.025}
              nodePaddingRatio={0.04}
              layout={{ nodeAlign: 'justify' }}
              style={{
                nodeFill: (d) => snapshotColorMap[nodeKey(d)] ?? '#8c8c8c',
                nodeStrokeWidth: 0,
                linkFill: (d) => {
                  const s = d?.source?.key ?? d?.source;
                  const t = d?.target?.key ?? d?.target;
                  // 連結用「族群端」的顏色（流入/釋出節點則用另一端）
                  const SYNTH = ['資金流入', '資金釋出'];
                  const key = SYNTH.includes(s) ? t : s;
                  return snapshotColorMap[key] ?? '#d9d9d9';
                },
                linkFillOpacity: 0.45,
                labelText: (d) => {
                  const key = String(nodeKey(d) ?? '');
                  const name = key.replace(/^上次·/, '').replace(/^現在·/, '');
                  const v = d.value;
                  return (v != null && !Number.isNaN(v)) ? `${name}  $${fmtMoney(v)}` : name;
                },
                labelFontSize: 12,
                labelFill: '#333',
                labelSpacing: 4,
              }}
              tooltip={{
                items: [{ field: 'value', name: '成本', valueFormatter: (v) => `$${fmtMoney(v)}` }],
              }}
              height={Math.max(320, rows.length * 52)}
              autoFit
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="尚無可比較的兩個交易日資料（需至少兩個有交易的日子）"
              style={{ padding: '60px 0' }}
            />
          )}
        </Card>
      ) : (
        <Card
          size="small"
          title="資金輪動"
          extra={<span style={{ color: '#999', fontSize: 12 }}>左＝賣出族群 · 中＝資金池 · 右＝買進族群（依當日成交額）</span>}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { padding: 12, flex: 1, minHeight: 0, overflow: 'auto' } }}
        >
          {rotationData.length > 0 ? (
            <Sankey
              data={rotationData}
              nodeWidthRatio={0.025}
              nodePaddingRatio={0.04}
              layout={{ nodeAlign: 'justify' }}
              style={{
                nodeFill: (d) => rotationColorMap[nodeKey(d)] ?? '#8c8c8c',
                nodeStrokeWidth: 0,
                linkFill: (d) => {
                  const s = d?.source?.key ?? d?.source;
                  const t = d?.target?.key ?? d?.target;
                  const key = s === POOL_NODE ? t : s;
                  return rotationColorMap[key] ?? '#d9d9d9';
                },
                linkFillOpacity: 0.45,
                labelText: (d) => {
                  const key = String(nodeKey(d) ?? '');
                  const name = key.replace(/^賣出·/, '').replace(/^買進·/, '');
                  const v = d.value;
                  return (v != null && !Number.isNaN(v)) ? `${name}  $${fmtMoney(v)}` : name;
                },
                labelFontSize: 12,
                labelFill: '#333',
                labelSpacing: 4,
              }}
              tooltip={{
                items: [{ field: 'value', name: '成交額', valueFormatter: (v) => `$${fmtMoney(v)}` }],
              }}
              height={Math.max(320, ((data?.rotation?.sells?.length || 0) + (data?.rotation?.buys?.length || 0)) * 48)}
              autoFit
            />
          ) : currPie.length > 0 ? (
            // 沒有買賣明細可畫輪動 → 退而顯示目前持倉佔比，避免空白畫面
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <div style={{ color: '#999', fontSize: 13, marginBottom: 4 }}>
                尚無買賣明細，以下為目前持倉佔比（依持倉成本）
              </div>
              <div style={{ flex: 1, minHeight: 200, maxWidth: 460, width: '100%', margin: '0 auto' }}>
                <Pie {...pieConfig(currPie)} height={undefined} autoFit />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', marginTop: 8 }}>
                {rows.map((r) => (
                  <span key={r.key} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: '#555' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, marginRight: 5 }} />
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="尚無持倉與買賣資料"
              style={{ padding: '60px 0' }}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default CategoryFlowView;
