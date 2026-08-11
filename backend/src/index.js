require('dotenv').config();

const { getNthWeekdayOfMonth, endOfDay, parseLocalDate, getNextMonthlyDueDate, getFirstMonthlyDueDate, getOccurrenceOfWeekday, getNextWeekdayOnOrAfter } = require('./lib/dates');
const { calculateAvatarLevel } = require('./lib/gamification');
const { simplifyDebts } = require('./lib/settleUp');

const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================================
// SETUP — Express app + Prisma client (with Prisma 7 driver adapter)
// ============================================================
const app = express();
app.use(cors());

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// ============================================================
// AUTH — dev-only stub login (temp for real Google login, to be implemented later!!)
// ============================================================
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

app.post('/auth/google/mobile', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await prisma.user.findFirst({ where: { googleId: payload.sub } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, householdId: user.householdId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Google ID token' });
  }
});

// ============================================================
// AUTH — middleware that protects routes by verifying the JWT
// ============================================================
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

// ============================================================
// CHORES — rotation helper functions
// Rotation tracked per-chore, cycling through household members in join order
// ============================================================
const FREQUENCY_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
const XP_PER_WEIGHT = 10;

// db passed in explicitly so this same func works both standalone and inside a $transaction
async function getNextAssignee(db, choreId, householdId) {
  const users = await db.user.findMany({
    where: { householdId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (users.length === 0) return null;

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  const index = chore.rotationIndex % users.length;
  return users[index];
}

async function advanceRotation(db, choreId) {
  await db.chore.update({
    where: { id: choreId },
    data: { rotationIndex: { increment: 1 } }, // atomic increment, avoids race conditions
  });
}

// Called whenever chores are listed
// Catches up any assignments whose due date has passed, even if never completed  
// marks the missed one "overdue" and rotates to the next person
async function ensureAssignmentsUpToDate(chore) {
  if (chore.type === 'one_time') {
    const assignment = await prisma.assignment.findFirst({ where: { choreId: chore.id } });
    if (assignment && assignment.dueDate < new Date() && !assignment.completedAt && assignment.status !== 'overdue') {
      const penalty = chore.weight * XP_PER_WEIGHT;
      await prisma.$transaction(async (tx) => {
        await tx.assignment.update({ where: { id: assignment.id }, data: { status: 'overdue' } });
        const missedUser = await tx.user.findUnique({ where: { id: assignment.userId } });
        const newXp = Math.max(0, missedUser.xp - penalty);
        const newLevel = Math.max(missedUser.avatarLevel, calculateAvatarLevel(newXp));
        await tx.user.update({ where: { id: assignment.userId }, data: { xp: newXp, avatarLevel: newLevel } });
        await tx.household.update({ where: { id: chore.householdId }, data: { streakCount: 0 } });
        await tx.notification.create({
          data: { userId: assignment.userId, type: 'chore_overdue', content: `You missed "${chore.name}" — lost ${penalty} XP` },
        });
      });
    }
    return;
  }

  const intervalMs = FREQUENCY_DAYS[chore.frequency] * 24 * 60 * 60 * 1000;

  let latest = await prisma.assignment.findFirst({
    where: { choreId: chore.id },
    orderBy: { dueDate: 'desc' },
  });

  while (latest && latest.dueDate < new Date()) {
    if (!latest.completedAt && latest.status !== 'overdue') {
      const penalty = chore.weight * XP_PER_WEIGHT;
      const missedUserId = latest.userId;

      await prisma.$transaction(async (tx) => {
        await tx.assignment.update({ where: { id: latest.id }, data: { status: 'overdue' } });
        const missedUser = await tx.user.findUnique({ where: { id: missedUserId } });
        const newXp = Math.max(0, missedUser.xp - penalty);
        const newLevel = Math.max(missedUser.avatarLevel, calculateAvatarLevel(newXp));
        await tx.user.update({ where: { id: missedUserId }, data: { xp: newXp, avatarLevel: newLevel } });
        await tx.household.update({ where: { id: chore.householdId }, data: { streakCount: 0 } });
        await tx.notification.create({
          data: { userId: missedUserId, type: 'chore_overdue', content: `You missed "${chore.name}" — lost ${penalty} XP` },
        });
      });
    }

    let nextAssigneeId;
    if (chore.assignmentMode === 'fixed') {
      nextAssigneeId = latest.userId; // same person again — no rotation
    } else {
      const assignee = await getNextAssignee(prisma, chore.id, chore.householdId);
      await advanceRotation(prisma, chore.id);
      nextAssigneeId = assignee.id;
    }

    const nextDueDate = chore.frequency === 'monthly'
      ? getNextMonthlyDueDate(latest.dueDate, chore.scheduleWeekday, chore.scheduleOccurrence)
      : endOfDay(new Date(latest.dueDate.getTime() + intervalMs));

    latest = await prisma.assignment.create({
      data: { choreId: chore.id, userId: nextAssigneeId, dueDate: nextDueDate },
    });
  }
}

const OVERDUE_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function sendOverdueReminders(chore) {
  const overdueAssignments = await prisma.assignment.findMany({
    where: { choreId: chore.id, status: 'overdue' },
  });

  for (const assignment of overdueAssignments) {
    const cooldownStart = new Date(Date.now() - OVERDUE_REMINDER_INTERVAL_MS);
    const recentReminder = await prisma.notification.findFirst({
      where: {
        userId: assignment.userId,
        type: 'chore_overdue_reminder',
        relatedAssignmentId: assignment.id,
        createdAt: { gte: cooldownStart },
      },
    });
    if (!recentReminder) {
      await prisma.notification.create({
        data: {
          userId: assignment.userId,
          type: 'chore_overdue_reminder',
          relatedAssignmentId: assignment.id,
          content: `Reminder: "${chore.name}" is still overdue`,
        },
      });
    }
  }
}

app.patch('/chores/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, weight, frequency, scheduleWeekday, scheduleDate, dueDate, assigneeId, assignmentMode } = req.body;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const chore = await prisma.chore.findUnique({ where: { id } });

  if (!chore) {
    return res.status(404).json({ error: 'Chore not found' });
  }
  if (chore.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This chore is not in your household' });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (weight !== undefined) data.weight = weight;

  let newPendingDueDate = null;
  let finalAssignmentMode = chore.assignmentMode;

  if (chore.type === 'recurring') {
    finalAssignmentMode = assignmentMode !== undefined ? assignmentMode : chore.assignmentMode;
    if (assignmentMode !== undefined) data.assignmentMode = assignmentMode;
    const finalFrequency = frequency !== undefined ? frequency : chore.frequency;
    if (frequency !== undefined) data.frequency = frequency;

    if (finalFrequency === 'monthly' && scheduleDate) {
      const exampleDate = parseLocalDate(scheduleDate);
      const { weekday, occurrence } = getOccurrenceOfWeekday(exampleDate);
      data.scheduleWeekday = weekday;
      data.scheduleOccurrence = occurrence;
      newPendingDueDate = getFirstMonthlyDueDate(weekday, occurrence);
    } else if ((finalFrequency === 'weekly' || finalFrequency === 'biweekly') && scheduleWeekday !== undefined) {
      data.scheduleWeekday = scheduleWeekday;
      data.scheduleOccurrence = null;
      newPendingDueDate = endOfDay(getNextWeekdayOnOrAfter(new Date(), scheduleWeekday));
    } else if (frequency !== undefined && finalFrequency !== 'monthly') {
      data.scheduleOccurrence = null;
    }
  }

  const updated = await prisma.chore.update({ where: { id }, data });

  // Reflect the new pattern on the current cycle immediately
  // A done/overdue assignment is a resolved past event for this cycle and is left untouched
  // New pattern applies starting next rotation in that case
  if (newPendingDueDate) {
    const pendingAssignment = await prisma.assignment.findFirst({
      where: { choreId: id, status: 'pending' },
      orderBy: { dueDate: 'desc' },
    });
    if (pendingAssignment) {
      await prisma.assignment.update({ where: { id: pendingAssignment.id }, data: { dueDate: newPendingDueDate } });
    }
  }

  if (chore.type === 'one_time' && (dueDate !== undefined || assigneeId !== undefined)) {
    const assignment = await prisma.assignment.findFirst({ where: { choreId: id } });
    if (assignment) {
      const assignmentData = {};
      if (dueDate !== undefined) assignmentData.dueDate = endOfDay(parseLocalDate(dueDate));
      if (assigneeId !== undefined) assignmentData.userId = assigneeId;
      await prisma.assignment.update({ where: { id: assignment.id }, data: assignmentData });
    }
  }

  if (chore.type === 'recurring' && finalAssignmentMode === 'fixed' && assigneeId !== undefined) {
    const pendingAssignment = await prisma.assignment.findFirst({
      where: { choreId: id, status: 'pending' },
      orderBy: { dueDate: 'desc' },
    });
    if (pendingAssignment) {
      await prisma.assignment.update({ where: { id: pendingAssignment.id }, data: { userId: assigneeId } });
    }
  }

  res.json({ chore: updated });
});

// ============================================================
// ROUTES — current user
// ============================================================
app.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { household: true },
  });
  res.json({ user });
});

app.patch('/me/avatar', requireAuth, async (req, res) => {
  const { avatarEmoji } = req.body;
  if (!avatarEmoji) {
    return res.status(400).json({ error: 'avatarEmoji is required' });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarEmoji },
  });

  res.json({ user });
});
// ============================================================
// ROUTES — households (create, join via invite code)
// ============================================================
app.post('/households/create', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const inviteCode = await generateUniqueInviteCode();
  const household = await prisma.household.create({ data: { name, inviteCode } });
  const user = await prisma.user.update({ where: { id: req.userId }, data: { householdId: household.id } });

  res.json({ household, user });
});

app.post('/households/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode is required' });

  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const joiningUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({ where: { id: req.userId }, data: { householdId: household.id } });

  const existingMembers = await prisma.user.findMany({
    where: { householdId: household.id, id: { not: req.userId } },
  });

  await Promise.all(existingMembers.map((member) =>
    prisma.notification.create({
      data: { userId: member.id, type: 'member_joined', content: `${joiningUser.name} joined the household! 👋` },
    })
  ));

  res.json({ household, user });
});

app.get('/households/stats', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const completedThisWeek = await prisma.assignment.count({
    where: {
      status: 'done',
      completedAt: { gte: sevenDaysAgo },
      chore: { householdId: currentUser.householdId },
    },
  });

  const householdOverdueCount = await prisma.assignment.count({
    where: { status: 'overdue', chore: { householdId: currentUser.householdId } },
  });

  res.json({ completedThisWeek, householdOverdueCount });
});

app.get('/households/members', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const members = await prisma.user.findMany({
    where: { householdId: currentUser.householdId },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ members });
});

app.patch('/households/rename', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const household = await prisma.household.update({
    where: { id: currentUser.householdId },
    data: { name },
  });

  res.json({ household });
});

app.post('/households/leave', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You are not in a household' });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { householdId: null },
  });

  res.json({ user });
});

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateUniqueInviteCode() {
  let code;
  while (true) {
    code = generateInviteCode();
    const existing = await prisma.household.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
}

// ============================================================
// ROUTES — announcements (create, list, resolve)
// ============================================================
app.post('/announcements', requireAuth, async (req, res) => {
  const { content, pinned } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const announcement = await prisma.announcement.create({
    data: {
      content,
      pinned: pinned || false,
      householdId: currentUser.householdId,
      authorId: req.userId,
    },
  });

  res.json({ announcement });
});

app.get('/announcements', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  // Pinned posts float to the top as a group; within each group, newest first.
  const announcements = await prisma.announcement.findMany({
    where: { householdId: currentUser.householdId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    include: { author: true },
  });

  res.json({ announcements });
});

app.patch('/announcements/:id/resolve', requireAuth, async (req, res) => {
  const { id } = req.params;

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { resolved: true },
  });

  res.json({ announcement: updated });
});

app.patch('/announcements/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { content, pinned } = req.body;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const announcement = await prisma.announcement.findUnique({ where: { id } });

  if (!announcement) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  if (announcement.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This announcement is not in your household' });
  }

  const data = {};
  if (content !== undefined) data.content = content;
  if (pinned !== undefined) data.pinned = pinned;

  const updated = await prisma.announcement.update({ where: { id }, data });
  res.json({ announcement: updated });
});

app.delete('/announcements/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const announcement = await prisma.announcement.findUnique({ where: { id } });

  if (!announcement) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  if (announcement.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This announcement is not in your household' });
  }

  await prisma.announcement.delete({ where: { id } });
  res.json({ deleted: true });
});
// ============================================================
// ROUTES — chores (create + assign, list with auto catch-up)
// ============================================================
app.post('/chores', requireAuth, async (req, res) => {
  const { name, type, frequency, weight, scheduleWeekday, scheduleDate, dueDate, assigneeId, assignmentMode } = req.body;
  const choreType = type || 'recurring';

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  if (choreType === 'one_time') {
    if (!dueDate || !assigneeId) {
      return res.status(400).json({ error: 'dueDate and assigneeId are required for one-time chores' });
    }
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.householdId !== currentUser.householdId) {
      return res.status(400).json({ error: 'assigneeId must be a member of your household' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const chore = await tx.chore.create({
        data: { name, type: 'one_time', weight: weight || 1, householdId: currentUser.householdId },
      });
      const assignment = await tx.assignment.create({
        data: { choreId: chore.id, userId: assigneeId, dueDate: endOfDay(parseLocalDate(dueDate)) },
      });
      return { chore, assignment };
    });

    return res.json(result);
  }

  if (!frequency) {
    return res.status(400).json({ error: 'frequency is required for recurring chores' });
  }

  const finalAssignmentMode = assignmentMode === 'fixed' ? 'fixed' : 'rotating';
  if (finalAssignmentMode === 'fixed' && !assigneeId) {
    return res.status(400).json({ error: 'assigneeId is required for a fixed-assignment chore' });
  }
  if (finalAssignmentMode === 'fixed') {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.householdId !== currentUser.householdId) {
      return res.status(400).json({ error: 'assigneeId must be a member of your household' });
    }
  }

  let scheduleData = {};
  let firstDueDate;

  if (frequency === 'monthly') {
    if (!scheduleDate) {
      return res.status(400).json({ error: 'scheduleDate is required for monthly chores' });
    }
    const exampleDate = parseLocalDate(scheduleDate);
    const { weekday, occurrence } = getOccurrenceOfWeekday(exampleDate);
    scheduleData = { scheduleWeekday: weekday, scheduleOccurrence: occurrence };
    firstDueDate = getFirstMonthlyDueDate(weekday, occurrence);
  } else if ((frequency === 'weekly' || frequency === 'biweekly') && scheduleWeekday !== undefined) {
    scheduleData = { scheduleWeekday };
    firstDueDate = endOfDay(getNextWeekdayOnOrAfter(new Date(), scheduleWeekday));
  } else {
    firstDueDate = endOfDay(new Date(Date.now() + FREQUENCY_DAYS[frequency] * 24 * 60 * 60 * 1000));
  }

  const result = await prisma.$transaction(async (tx) => {
    const chore = await tx.chore.create({
      data: {
        name, type: 'recurring', frequency, weight: weight || 1, householdId: currentUser.householdId,
        assignmentMode: finalAssignmentMode, ...scheduleData,
      },
    });

    let firstAssigneeId;
    if (finalAssignmentMode === 'fixed') {
      firstAssigneeId = assigneeId;
    } else {
      const assignee = await getNextAssignee(tx, chore.id, chore.householdId);
      await advanceRotation(tx, chore.id);
      firstAssigneeId = assignee.id;
    }

    const assignment = await tx.assignment.create({
      data: { choreId: chore.id, userId: firstAssigneeId, dueDate: firstDueDate },
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
    await sendOverdueReminders(chore);
  }

  const choresWithOverdue = await prisma.chore.findMany({
    where: { householdId: currentUser.householdId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      assignments: {
        where: { status: 'overdue' },
        orderBy: { dueDate: 'desc' },
        include: { user: true },
      },
    },
  });

  const currentAssignments = await prisma.assignment.findMany({
    where: { chore: { householdId: currentUser.householdId }, status: { not: 'overdue' } },
    orderBy: { dueDate: 'desc' },
    distinct: ['choreId'],
    include: { user: true },
  });
  const currentByChoreId = Object.fromEntries(currentAssignments.map((a) => [a.choreId, a]));

  const updatedChores = choresWithOverdue.map((chore) => {
    const current = currentByChoreId[chore.id];
    const assignments = current ? [current, ...chore.assignments] : [...chore.assignments];
    return { ...chore, assignments };
  });

  res.json({ chores: updatedChores });
});

app.delete('/chores/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const chore = await prisma.chore.findUnique({ where: { id } });

  if (!chore) {
    return res.status(404).json({ error: 'Chore not found' });
  }
  if (chore.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This chore is not in your household' });
  }

  await prisma.chore.delete({ where: { id } });

  res.json({ deleted: true });
});
// ============================================================
// ROUTES — assignments (mark complete)
// Requires both authentication (valid token) AND authorization
// (this assignment actually belongs to the requesting user)
// ============================================================
app.patch('/assignments/:id/complete', requireAuth, async (req, res) => {
  const { id } = req.params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { chore: true },
  });
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.userId !== req.userId) {
    return res.status(403).json({ error: 'This assignment is not yours' });
  }

  const wasOnTime = assignment.status !== 'overdue';
  const xpEarned = assignment.chore.weight * XP_PER_WEIGHT;

  const result = await prisma.$transaction(async (tx) => {
    const updatedAssignment = await tx.assignment.update({
      where: { id },
      data: { completedAt: new Date(), status: 'done' },
    });

    const user = await tx.user.findUnique({ where: { id: req.userId } });
    const newXp = user.xp + xpEarned;
    const newLevel = Math.max(user.avatarLevel, calculateAvatarLevel(newXp));
    const updatedUser = await tx.user.update({
      where: { id: req.userId },
      data: { xp: newXp, avatarLevel: newLevel },
    });

    await tx.household.update({
      where: { id: assignment.chore.householdId },
      data: wasOnTime ? { streakCount: { increment: 1 } } : { streakCount: 0 },
    });

    const householdMembers = await tx.user.findMany({
      where: { householdId: assignment.chore.householdId, id: { not: req.userId } },
    });

    await Promise.all(householdMembers.map((member) =>
      tx.notification.create({
        data: {
          userId: member.id,
          type: 'chore_completed',
          content: `${user.name} completed "${assignment.chore.name}" ✅`,
        },
      })
    ));

    return { assignment: updatedAssignment, user: updatedUser, xpEarned };
  });

  res.json(result);
});

// ============================================================
// ROUTES — expenses (create with even split, settle-up algorithm)
// ============================================================
app.post('/expenses', requireAuth, async (req, res) => {
  const { description, amount } = req.body;
  if (!description || !amount) {
    return res.status(400).json({ error: 'description and amount are required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const householdUsers = await prisma.user.findMany({ where: { householdId: currentUser.householdId } });
  const splitAmount = amount / householdUsers.length;

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        description,
        amount,
        householdId: currentUser.householdId,
        payerId: req.userId,
      },
    });

    // Even split across everyone in the household; 
    // payer's own share is pre-settled since they don't owe themselves
    const shares = await Promise.all(householdUsers.map((user) =>
      tx.expenseShare.create({
        data: {
          expenseId: expense.id,
          userId: user.id,
          amount: splitAmount,
          settled: user.id === req.userId,
        },
      })
    ));

    return { expense, shares };
  });

  res.json(result);
});

app.get('/households/settle-up', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const shares = await prisma.expenseShare.findMany({
    where: { user: { householdId: currentUser.householdId }, settled: false },
    include: { expense: true, user: true },
  });

  // net each person's overall balance across all unsettled shares
  const transactions = simplifyDebts(shares);

  const userIds = [...new Set(transactions.flatMap((t) => [t.from, t.to]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const transactionsWithNames = transactions.map((t) => ({ ...t, fromName: nameMap[t.from], toName: nameMap[t.to] }));

  res.json({ transactions: transactionsWithNames });
});

app.get('/expenses', requireAuth, async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  const expenses = await prisma.expense.findMany({
    where: { householdId: currentUser.householdId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: { payer: true, shares: true },
  });

  res.json({ expenses });
});


app.post('/households/settle-up/confirm', requireAuth, async (req, res) => {
  const { userA, userB } = req.body;
  if (!userA || !userB) {
    return res.status(400).json({ error: 'userA and userB are required' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser.householdId) {
    return res.status(400).json({ error: 'You must join a household first' });
  }

  await prisma.expenseShare.updateMany({
    where: {
      settled: false,
      user: { householdId: currentUser.householdId },
      OR: [
        { userId: userA, expense: { payerId: userB } },
        { userId: userB, expense: { payerId: userA } },
      ],
    },
    data: { settled: true },
  });

  res.json({ settled: true });
});

app.patch('/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { description, amount } = req.body;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const expense = await prisma.expense.findUnique({ where: { id } });

  if (!expense) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  if (expense.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This expense is not in your household' });
  }

  const householdUsers = await prisma.user.findMany({ where: { householdId: currentUser.householdId } });
  const splitAmount = amount !== undefined ? amount / householdUsers.length : null;

  const updated = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.update({
      where: { id },
      data: {
        ...(description !== undefined ? { description } : {}),
        ...(amount !== undefined ? { amount } : {}),
      },
    });

    if (amount !== undefined) {
      await tx.expenseShare.updateMany({ where: { expenseId: id }, data: { amount: splitAmount } });
    }

    return exp;
  });

  res.json({ expense: updated });
});

app.delete('/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const expense = await prisma.expense.findUnique({ where: { id } });

  if (!expense) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  if (expense.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This expense is not in your household' });
  }

  await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expenseId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);

  res.json({ deleted: true });
});
// ============================================================
// NUDGING
// ============================================================

const NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

app.post('/assignments/:id/nudge', requireAuth, async (req, res) => {
  const { id } = req.params;

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { chore: true, user: true },
  });

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.chore.householdId !== currentUser.householdId) {
    return res.status(403).json({ error: 'This chore is not in your household' });
  }
  if (assignment.userId === req.userId) {
    return res.status(400).json({ error: "You can't nudge yourself" });
  }
  if (assignment.status === 'done') {
    return res.status(400).json({ error: 'This chore is already done' });
  }

  const cooldownStart = new Date(Date.now() - NUDGE_COOLDOWN_MS);
  const recentNudge = await prisma.notification.findFirst({
    where: { userId: assignment.userId, type: 'nudge', createdAt: { gte: cooldownStart } },
  });
  if (recentNudge) {
    return res.status(429).json({ error: `${assignment.user.name} was already nudged recently. Try again later.` });
  }

  await prisma.notification.create({
    data: {
      userId: assignment.userId,
      type: 'nudge',
      content: `${currentUser.name} nudged you about "${assignment.chore.name}"`,
    },
  });

  res.json({ nudged: true });
});

app.get('/notifications', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId, read: false },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ notifications });
});

app.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.userId) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ read: true });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));