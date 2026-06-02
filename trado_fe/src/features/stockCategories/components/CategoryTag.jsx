import React from 'react';
import { useThemePalette } from '../hooks/useThemePalette';

/**
 * 族群 tag — 使用主題衍生色票，而非 AntD 固定 preset
 *
 * props:
 *   color    color name (red/orange/...) — 對應到 theme palette slot
 *   size     'sm' | 'md'（預設 md）
 *   onClick  optional
 *   children name
 */
const CategoryTag = ({
  color = 'blue',
  size = 'md',
  onClick,
  style: styleOverride,
  children,
  ...rest
}) => {
  const { getStyle } = useThemePalette();
  const themed = getStyle(color);

  const sizeStyle =
    size === 'sm'
      ? { padding: '0px 8px', fontSize: 12, lineHeight: '20px' }
      : { padding: '2px 10px', fontSize: 13, lineHeight: '22px' };

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 4,
        border: '1px solid',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'background 0.15s, border-color 0.15s',
        ...sizeStyle,
        ...themed,
        ...styleOverride,
      }}
      {...rest}
    >
      {children}
    </span>
  );
};

export default CategoryTag;
