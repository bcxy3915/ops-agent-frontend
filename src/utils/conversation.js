/**
 * 会话时间分组工具
 *
 * 分组规则（参考 DeepSeek / Kimi）：
 *  ┌─────────────┬──────────────────────────────────┐
 *  │ 今天        │ lastActiveAt >= 今日 00:00        │
 *  │ 7天内       │ 今日 00:00 > lastActiveAt >= 7天前│
 *  │ YYYY-MM     │ 更早的按年月分组                  │
 *  └─────────────┴──────────────────────────────────┘
 */

/**
 * 把会话列表按时间分组
 *
 * @param {Array} conversations 会话列表（后端已按 lastActiveAt 倒序）
 * @returns {Array<{label: string, items: Array}>}
 */
export function groupConversations(conversations) {
    if (!conversations || conversations.length === 0) return []
  
    // ★ 计算"今天 00:00"和"7 天前 00:00"两个时间边界
    //    用 new Date(y, m, d) 能自动处理月末、闰年等边界
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  
    // 三个桶
    const todayItems = []
    const weekItems = []
    const monthlyGroups = {} // { 'YYYY-MM': [...] }
  
    conversations.forEach((conv) => {
      const time = new Date(conv.lastActiveAt)
  
      if (time >= today) {
        todayItems.push(conv)
      } else if (time >= sevenDaysAgo) {
        weekItems.push(conv)
      } else {
        // ★ 年月 key，补零保证排序正确（'2026-08' < '2026-09'）
        const key = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyGroups[key]) monthlyGroups[key] = []
        monthlyGroups[key].push(conv)
      }
    })
  
    // ★ 组装：今天 → 7天内 → 月度（倒序）
    const result = []
    if (todayItems.length > 0) result.push({ label: '今天', items: todayItems })
    if (weekItems.length > 0) result.push({ label: '7天内', items: weekItems })
  
    // 月度 key 直接字符串倒序即可（因为 'YYYY-MM' 格式天然可比）
    Object.keys(monthlyGroups)
      .sort()
      .reverse()
      .forEach((key) => {
        result.push({ label: key, items: monthlyGroups[key] })
      })
  
    return result
  }
  
  /**
   * 格式化会话项的显示时间
   *
   * 规则：
   *  - 今天    → HH:mm
   *  - 昨天    → "昨天"
   *  - 更早    → MM-DD
   *
   * @param {string} isoString ISO 8601 时间字符串
   */
  export function formatConversationTime(isoString) {
    if (!isoString) return ''
  
    const time = new Date(isoString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  
    const pad = (n) => String(n).padStart(2, '0')
  
    if (time >= today) {
      return `${pad(time.getHours())}:${pad(time.getMinutes())}`
    }
    if (time >= yesterday) {
      return '昨天'
    }
    return `${pad(time.getMonth() + 1)}-${pad(time.getDate())}`
  }