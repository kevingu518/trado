import { useId } from 'react'

const Sparkline = ({ data, color, vbw = 300, h = 40 }) => {
  const gradientId = useId()

  if (!data || data.length < 2) return null
  const min  = Math.min(...data)
  const max  = Math.max(...data)
  const rng  = max - min || 1
  const pad  = 4
  const ih   = h - pad * 2
  const step = vbw / (data.length - 1)
  const pts  = data.map((v, i) => [i * step, pad + ih - ((v - min) / rng) * ih])
  const poly = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const last = pts[pts.length - 1]
  const fill =
    `M${pts[0][0]},${pts[0][1]} ` +
    pts.slice(1).map(([x, y]) => `L${x},${y}`).join(' ') +
    ` L${last[0]},${h} L${pts[0][0]},${h} Z`

  return (
    <svg viewBox={`0 0 ${vbw} ${h}`} preserveAspectRatio="none"
      style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  )
}

export default Sparkline
