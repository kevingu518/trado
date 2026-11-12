import React from 'react'
import { Tooltip } from 'antd'

/**
 * 數據區塊裡的單一列：左邊標籤＋一行說明，右邊數字。
 * 沒有框線、沒有底色，列與列之間只有一條細線，跟下方表格同一種節奏。
 * status 只決定顏色與標籤前的圓點：danger=要處理、warning=要注意、neutral=只是資訊。
 * hint 是「這個數字怎麼算的」，滑過去才看得到；sub 是常駐的一行補充。
 */
const RiskKpi = ({ label, value, hint, sub, status = 'neutral', valueSize }) => (
  <Tooltip title={hint || null}>
    <div className={`risk-kpi risk-kpi--${status}`}>
      <span className="risk-kpi-label">{label}</span>
      {sub && <span className="risk-kpi-sub">{sub}</span>}
      <span
        className="risk-kpi-value fw-600"
        style={valueSize ? { fontSize: valueSize } : undefined}
      >
        {value}
      </span>
    </div>
  </Tooltip>
)

export default RiskKpi
