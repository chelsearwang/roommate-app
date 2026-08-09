function simplifyDebts(shares) {
  const balances = {};
  for (const share of shares) {
    const oweUserId = share.userId;
    const owedUserId = share.expense.payerId;
    balances[oweUserId] = (balances[oweUserId] || 0) - Number(share.amount);
    balances[owedUserId] = (balances[owedUserId] || 0) + Number(share.amount);
  }

  const debtors = Object.entries(balances).filter(([_, bal]) => bal < 0).map(([id, bal]) => ({ id, bal: -bal }));
  const creditors = Object.entries(balances).filter(([_, bal]) => bal > 0).map(([id, bal]) => ({ id, bal }));

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].bal, creditors[j].bal);
    transactions.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].bal -= amount;
    creditors[j].bal -= amount;
    if (debtors[i].bal === 0) i++;
    if (creditors[j].bal === 0) j++;
  }
  return transactions;
}

module.exports = { simplifyDebts };