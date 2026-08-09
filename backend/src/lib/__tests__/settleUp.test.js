const { simplifyDebts } = require('../settleUp');

describe('simplifyDebts', () => {
  test('returns nothing when no one owes anything', () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  test('matches a single debtor to a single creditor', () => {
    const shares = [{ userId: 'alice', amount: 10, expense: { payerId: 'bob' } }];
    expect(simplifyDebts(shares)).toEqual([{ from: 'alice', to: 'bob', amount: 10 }]);
  });

  test('nets balances across multiple expenses between the same two people', () => {
    const shares = [
      { userId: 'alice', amount: 20, expense: { payerId: 'bob' } },
      { userId: 'bob', amount: 5, expense: { payerId: 'alice' } },
    ];
    expect(simplifyDebts(shares)).toEqual([{ from: 'alice', to: 'bob', amount: 15 }]);
  });

  test('minimizes transaction count across three people', () => {
    const shares = [
      { userId: 'alice', amount: 10, expense: { payerId: 'charlie' } },
      { userId: 'bob', amount: 10, expense: { payerId: 'charlie' } },
    ];
    expect(simplifyDebts(shares)).toEqual(expect.arrayContaining([
      { from: 'alice', to: 'charlie', amount: 10 },
      { from: 'bob', to: 'charlie', amount: 10 },
    ]));
  });
});