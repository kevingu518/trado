import {
  COLOR_NAMES,
  COLOR_PALETTE,
  getHex,
  getTagStyleFromHex,
} from '../themePalette';

/**
 * 族群色票存取入口
 *  - palette: { name -> hex } 全表
 *  - names:   可用 color name 順序
 *  - getHex(name):   取 hex
 *  - getStyle(name): 取 Tag 三層樣式
 */
export const useThemePalette = () => ({
  palette: COLOR_PALETTE,
  names: COLOR_NAMES,
  getHex,
  getStyle: (name) => getTagStyleFromHex(getHex(name)),
});

export default useThemePalette;
