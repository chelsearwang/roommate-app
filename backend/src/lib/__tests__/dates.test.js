const { getNthWeekdayOfMonth, getOccurrenceOfWeekday, getNextWeekdayOnOrAfter, getNextMonthlyDueDate, parseLocalDate, endOfDay } = require('../dates');

describe('getNthWeekdayOfMonth', () => {
  test('finds the third Friday of July 2026', () => {
    expect(getNthWeekdayOfMonth(2026, 6, 5, 'third').getDate()).toBe(17);
  });

  test('"last" finds the true final occurrence, even in a 5-occurrence month', () => {
    const fourth = getNthWeekdayOfMonth(2026, 6, 5, 'fourth');
    const last = getNthWeekdayOfMonth(2026, 6, 5, 'last');
    expect(fourth.getDate()).toBe(24);
    expect(last.getDate()).toBe(31);
  });
});

describe('getOccurrenceOfWeekday', () => {
  test('correctly identifies August 21, 2026 as the third Friday', () => {
    const { weekday, occurrence } = getOccurrenceOfWeekday(new Date(2026, 7, 21));
    expect(weekday).toBe(5);
    expect(occurrence).toBe('third');
  });

  test('maps a 5th-occurrence date to "last", never an unsupported "fifth"', () => {
    expect(getOccurrenceOfWeekday(new Date(2026, 6, 31)).occurrence).toBe('last');
  });
});

describe('getNextWeekdayOnOrAfter', () => {
  test('returns today if it already matches the target weekday', () => {
    expect(getNextWeekdayOnOrAfter(new Date(2026, 6, 17), 5).getDate()).toBe(17);
  });

  test('rolls forward to the next matching weekday otherwise', () => {
    expect(getNextWeekdayOnOrAfter(new Date(2026, 6, 14), 5).getDate()).toBe(17);
  });
});

describe('getNextMonthlyDueDate', () => {
  test('rolls a monthly recurrence into the next month correctly', () => {
    const result = getNextMonthlyDueDate(new Date(2026, 6, 21), 5, 'third');
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(21);
  });
});

describe('parseLocalDate', () => {
  test('parses as local midnight, not UTC midnight', () => {
    const result = parseLocalDate('2026-08-05');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(5);
  });
});

describe('endOfDay', () => {
  test('sets the time to 23:59:59.999 on the same day', () => {
    const result = endOfDay(new Date(2026, 7, 5, 9, 30));
    expect(result.getHours()).toBe(23);
    expect(result.getDate()).toBe(5);
  });
});