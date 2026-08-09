function calculateAvatarLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

module.exports = { calculateAvatarLevel };