const TaskParser = (() => {
  const dateKeywords = {
    '今天': 0,
    '明天': 1,
    '后天': 2,
    '大后天': 3
  };

  const weekDays = {
    '周一': 1, '星期一': 1,
    '周二': 2, '星期二': 2,
    '周三': 3, '星期三': 3,
    '周四': 4, '星期四': 4,
    '周五': 5, '星期五': 5,
    '周六': 6, '星期六': 6,
    '周日': 0, '星期日': 0, '周天': 0
  };

  const timeKeywords = {
    '早上': 8, '上午': 9, '中午': 12,
    '下午': 14, '傍晚': 17, '晚上': 20, '深夜': 23
  };

  const priorityKeywords = {
    '高': 'high',
    '中': 'medium',
    '低': 'low',
    '紧急': 'high',
    '重要': 'high',
    '一般': 'medium'
  };

  function parse(text) {
    let remaining = text;
    const result = {
      title: '',
      tags: [],
      priority: null,
      dueDate: null,
      recurring: null
    };

    const tagMatches = remaining.match(/#[^\s#]+/g);
    if (tagMatches) {
      result.tags = tagMatches.map(t => t.slice(1));
      remaining = remaining.replace(/#[^\s#]+/g, '').trim();
    }

    const priorityMatch = remaining.match(/!([高中低紧急重要一般]+)/);
    if (priorityMatch) {
      const key = priorityMatch[1];
      result.priority = priorityKeywords[key] || 'medium';
      remaining = remaining.replace(/![高中低紧急重要一般]+/g, '').trim();
    }

    const dateResult = extractDate(remaining);
    if (dateResult.date) {
      result.dueDate = dateResult.date;
      remaining = dateResult.remaining;
    }

    if (remaining.includes('重复') || remaining.includes('每天') || remaining.includes('每周')) {
      result.recurring = extractRecurring(remaining);
      remaining = remaining.replace(/(重复|每天|每周[一二三四五六日天]?)/g, '').trim();
    }

    result.title = remaining.replace(/\s+/g, ' ').trim();

    return result;
  }

  function extractDate(text) {
    let date = null;
    let remaining = text;

    for (const [keyword, days] of Object.entries(dateKeywords)) {
      if (remaining.includes(keyword)) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        date = d;
        remaining = remaining.replace(keyword, '');
        break;
      }
    }

    if (!date) {
      for (const [keyword, dayNum] of Object.entries(weekDays)) {
        if (remaining.includes(keyword)) {
          const d = new Date();
          const currentDay = d.getDay();
          let diff = dayNum - currentDay;
          if (diff <= 0) diff += 7;
          d.setDate(d.getDate() + diff);
          date = d;
          remaining = remaining.replace(keyword, '');
          break;
        }
      }
    }

    if (!date) {
      const monthDayMatch = remaining.match(/(\d{1,2})月(\d{1,2})[日号]/);
      if (monthDayMatch) {
        const d = new Date();
        d.setMonth(parseInt(monthDayMatch[1]) - 1, parseInt(monthDayMatch[2]));
        if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
        date = d;
        remaining = remaining.replace(monthDayMatch[0], '');
      }
    }

    if (date) {
      let hours = 9, minutes = 0;

      for (const [keyword, hour] of Object.entries(timeKeywords)) {
        if (remaining.includes(keyword)) {
          hours = hour;
          remaining = remaining.replace(keyword, '');
          break;
        }
      }

      const timeMatch = remaining.match(/(\d{1,2})[点时](\d{1,2})?分?/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        if (timeMatch[2]) minutes = parseInt(timeMatch[2]);
        if (hours < 12 && remaining.includes('下午')) hours += 12;
        remaining = remaining.replace(timeMatch[0], '');
      }

      date.setHours(hours, minutes, 0, 0);
    }

    return { date: date ? date.getTime() : null, remaining: remaining.trim() };
  }

  function extractRecurring(text) {
    if (text.includes('每天')) return { frequency: 'daily' };
    if (text.includes('每周')) {
      const dayMatch = text.match(/每周([一二三四五六日天])/);
      if (dayMatch) {
        const dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
        return { frequency: 'weekly', day: dayMap[dayMatch[1]] };
      }
      return { frequency: 'weekly' };
    }
    return { frequency: 'daily' };
  }

  return { parse };
})();

if (typeof module !== 'undefined') {
  module.exports = TaskParser;
}
