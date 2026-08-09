const OCCURRENCE_INDEX = { first: 0, second: 1, third: 2, fourth: 3 };

function getNthWeekdayOfMonth(year, month, weekday, occurrence) {
  if (occurrence === 'last') {
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const diff = (lastDayOfMonth.getDay() - weekday + 7) % 7;
    lastDayOfMonth.setDate(lastDayOfMonth.getDate() - diff);
    return lastDayOfMonth;
  }
  const firstOfMonth = new Date(year, month, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  const day = 1 + offset + OCCURRENCE_INDEX[occurrence] * 7;
  return new Date(year, month, day);
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getNextMonthlyDueDate(currentDueDate, weekday, occurrence) {
  const next = new Date(currentDueDate);
  next.setMonth(next.getMonth() + 1);
  return endOfDay(getNthWeekdayOfMonth(next.getFullYear(), next.getMonth(), weekday, occurrence));
}

function getFirstMonthlyDueDate(weekday, occurrence) {
  const now = new Date();
  const candidate = getNthWeekdayOfMonth(now.getFullYear(), now.getMonth(), weekday, occurrence);
  if (candidate < now) return getNextMonthlyDueDate(candidate, weekday, occurrence);
  return endOfDay(candidate);
}

function getOccurrenceOfWeekday(date) {
  const day = date.getDate();
  const weekday = date.getDay();
  const occurrenceIndex = Math.floor((day - 1) / 7);
  const OCCURRENCE_NAMES = ['first', 'second', 'third', 'fourth'];
  const occurrence = occurrenceIndex < 4 ? OCCURRENCE_NAMES[occurrenceIndex] : 'last';
  return { weekday, occurrence };
}

function getNextWeekdayOnOrAfter(startDate, weekday) {
  const result = new Date(startDate);
  const diff = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

module.exports = {
  getNthWeekdayOfMonth, endOfDay, parseLocalDate, getNextMonthlyDueDate,
  getFirstMonthlyDueDate, getOccurrenceOfWeekday, getNextWeekdayOnOrAfter,
};