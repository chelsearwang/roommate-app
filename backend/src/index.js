require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
// const prisma = new PrismaClient();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// --- Dev-only stub login ---
app.post('/auth/dev-login', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  let user = await prisma.user.findFirst({ where: { name } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        googleId: `dev-${name}`,
        email: `${name}@dev.local`,
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, householdId: user.householdId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.householdId = decoded.householdId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- A protected test route ---
app.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json({ user });
});

app.listen(3000, () => console.log('Server running on port 3000'));