import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Tooltip } from 'antd'
import { AlertOutlined } from '@ant-design/icons'
import { useRiskAlerts } from '../contexts/RiskAlertsContext'
import '../styles/index.scss'

/**
 * 儀表板上的停損警示摘要條
 *
 * 只放「今天需要看一眼」的數字，點整條進風險中心。沒有持倉警示時整條不顯示，
 * 不要留一個 0 的空條佔位。
 */
const AlertSummaryStrip = () => {
  const navigate = useNavigate()
  const { asOf, alerts, summary, unackedCount, loaded } = useRiskAlerts()

  if (!loaded || alerts.length === 0) return null

  const go = () => navigate('/risk')

  return (
    <div
      className="risk-alert-strip"
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
    >
      <AlertOutlined className="risk-alert-strip-icon" />
      <span className="risk-alert-strip-title">停損警示</span>
      {summary.breach > 0 && <Tag color="red">跌破 {summary.breach}</Tag>}
      {summary.near > 0 && <Tag color="orange">接近 {summary.near}</Tag>}
      {summary.invalidStop > 0 && <Tag color="volcano">停損設錯邊 {summary.invalidStop}</Tag>}
      {summary.noStop > 0 && <Tag color="blue">未設停損 {summary.noStop}</Tag>}
      {asOf && (
        <span className="risk-alert-strip-date">{asOf.replaceAll('-', '/')} 收盤</span>
      )}
      <Tooltip title={unackedCount > 0 ? '還沒標記已讀的警示' : '今日警示都已確認'}>
        <span className="risk-alert-strip-more">
          {unackedCount > 0 ? `${unackedCount} 則未處理 →` : '已全部確認 →'}
        </span>
      </Tooltip>
    </div>
  )
}

export default AlertSummaryStrip
