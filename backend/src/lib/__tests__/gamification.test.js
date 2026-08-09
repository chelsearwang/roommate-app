const { calculateAvatarLevel } = require('../gamification');

describe('calculateAvatarLevel', () => {
  test('starts at level 1 with zero XP', () => expect(calculateAvatarLevel(0)).toBe(1));
  test('reaches level 2 at exactly 50 XP', () => expect(calculateAvatarLevel(50)).toBe(2));
  test('reaches level 3 at exactly 200 XP', () => expect(calculateAvatarLevel(200)).toBe(3));
  test('does not level up just below a threshold', () => {
    expect(calculateAvatarLevel(49)).toBe(1);
    expect(calculateAvatarLevel(199)).toBe(2);
  });
});