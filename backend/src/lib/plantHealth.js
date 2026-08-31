function calculatePlantHealth(completedCount, overdueCount) {
  const total = completedCount + overdueCount;
  if (total === 0) return 'thriving'; // nothing has come due yet to judge
  const successRatio = completedCount / total;
  if (successRatio >= 0.9) return 'thriving';
  if (successRatio >= 0.6) return 'healthy';
  if (successRatio >= 0.3) return 'struggling';
  return 'wilted';
}

module.exports = { calculatePlantHealth };