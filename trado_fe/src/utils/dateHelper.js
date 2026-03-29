/**
 * 日期工具函式
 */

/**
 * 格式化日期：ISO 字串 → YYYY-MM-DD
 * @param {string|null|undefined} dateString ISO 日期字串
 * @returns {string|null} 格式化後的日期字串
 */
export const formatDate = (dateString) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  } catch (error) {
    console.error('日期格式化錯誤:', error)
    return null
  }
}

/**
 * 格式化日期時間：ISO 字串 → YYYY-MM-DD HH:mm:ss
 * @param {string|null|undefined} dateString ISO 日期字串
 * @returns {string|null} 格式化後的日期時間字串
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.error('日期時間格式化錯誤:', error)
    return null
  }
}

export default {
  formatDate,
  formatDateTime,
}
