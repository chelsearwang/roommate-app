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

const FREQUENCY_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };

async function getNextAssignee(db, choreId, householdId) {
  const users = await db.user.findMany({
    where: { householdId },
    orderBy: { createdAt: 'asc' },
  });
  if (users.length === 0) return null;

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  const index = chore.rotationIndex % users.length;
  return users[index];
}

async function advanceRotation(db, choreId) {
  await db.chore.update({
    where: { id: choreId },
    data: { rotationIndex: { increment: 1 } },
  });
}

async function ensureAssignmentsUpToDate(chore) {
  const intervalMs = FREQUENCY_DAYS[chore.frequency] * 24 * 60 * 60 * 1000;

  let latest = await prisma.assignment.findFirst({
    where: { choreId: chore.id },
    orderBy: { dueDate: 'desc' },
  });

  while (latest && latest.dueDate < new Date()) {
    if (!latest.completedAt && latest.status !== 'overdue') {
      await prisma.assignment.update({
        where: { id: latest.id },
        data: { status: 'overdue' },
      });
    }

    const assignee = await getNextAssignee(prisma, chore.id, chore.householdId);
    await advanceRotation(prisma, chore.id);

    latest = await prisma.assignment.create({
      data: {
        choreId: chore.id,
        userId: assignee.id,
        dueDate: new Date(latest.dueDate.getTime() + intervalMs),
      },
    });
  }
}

// --- A protected test route ---
app.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json({ user });
});

// Create a new household, and make the creator its first member
app.post('/households/create', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const household = await prisma.household.create({ data: { name } });

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { householdId: household.id },
  });

  res.json({ household, user });
});

// Join an existing household using its invite code
app.post('/households/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode is required' });
  }

  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) {
    return res.status(404).json({ error: 'Household not found' });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { householdId: household.id },
  });

  res.json({ household, user });
});

app.post('/chores', requireAuth, async (req, res) => {
  const { name, frequency, weight } = req.body;
  if (!name || !frequency) {
    return res.status(400).json({ error: 'name and frequency are required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const chore = await tx.chore.create({
      data: { name, frequency, weight: weight || 1, householdId: currentUser.householdId },
    });

    const assignee = await getNextAssignee(tx, chore.id, chore.householdId);
    await advanceRotation(tx, chore.id);

    const assignment = await tx.assignment.create({
      data: {
        choreId: chore.id,
        userId: assignee.id,
        dueDate: new Date(Date.now() + FREQUENCY_DAYS[frequency] * 24 * 60 * 60 * 1000),
      },
    });

    return { chore, assignment };
  });

  res.json(result);
});

app.get('/chores', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const chores = await prisma.chore.findMany({ where: { householdId: currentUser.householdId } });

  for (const chore of chores) {
    await ensureAssignmentsUpToDate(chore);
  }

  const updatedChores = await prisma.chore.findMany({
    where: { householdId: currentUser.householdId },
    include: {
      assignments: { orderBy: { dueDate: 'desc' }, take: 1 },
    },
  });

  res.json({ chores: updatedChores });
});

app.patch('/assignments/:id/complete', requireAuth, async (req, res) => {
  const { id } = req.params;

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.userId !== req.userId) {
    return res.status(403).json({ error: 'This assignment is not yours' });
  }

  const updated = await prisma.assignment.update({
    where: { id },
    data: { completedAt: new Date(), status: 'done' },
  });

  res.json({ assignment: updated });
});

app.listen(3000, () => console.log('Server running on port 3000'));