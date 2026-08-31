# RoomManager

A full-stack mobile app that helps roommates coordinate chores, split expenses, and stay in sync.

**🔗 Live app:** [roommanager-kkw4.onrender.com](https://roommanager-kkw4.onrender.com)
**🔗 API:** [roommate-app-backend.onrender.com](https://roommate-app-backend.onrender.com)

> The backend is hosted on Render's free tier, which goes to sleep after a period of inactivity. The first load may take 30–50 seconds to wake up.

---

## What it does

- **Chores** — recurring or one-time, split fairly via automatic rotation *or* assigned to one specific person; custom recurrence like "the 3rd Friday of every month"; overdue tracking that keeps a missed chore visible until it's actually resolved
- **Expenses** — log shared costs, automatic even-split, and a debt-simplification algorithm that finds the minimum number of payments needed to settle up the whole household
- **Announcements** — a shared household bulletin board, with pinning and resolution tracking
- **Gamification** — a shared plant that reflects how the household's actually doing (thriving to wilted, based on completed vs. overdue chores)
- **Real authentication** — Google Sign-In, working natively on iOS and Android, and via a custom web OAuth flow in the browser
- **In-app notifications** — nudges, overdue reminders, chore-completed alerts, and new-member notifications

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile / Web | React Native, Expo (Expo Router), TypeScript |
| Backend | Node.js, Express |
| Database | PostgreSQL ([Neon](https://neon.tech) — serverless) |
| ORM | Prisma |
| Auth | Google OAuth 2.0, JWT |
| Testing | Jest |
| Deployment | Render (backend + static web export) |

---

## Technical Highlights

Chore rotation checks due dates whenever someone opens the app, and a `while` loop fast-forwards through any cycles that were missed while nobody had it open.

The settle-up algorithm nets out everyone's balance first, then greedily pairs debtors with creditors so the household ends up with the fewest possible number of actual payments, instead of everyone paying everyone.

Custom recurrence (like "3rd Friday of every month") gets derived automatically from tapping a date on the calendar. Edge case: some months don't have a 5th occurrence of a given weekday, so that had to be handled explicitly.

Web OAuth was originally a popup flow, and it broke in production. Google's login pages set a strict `Cross-Origin-Opener-Policy` header that kills popup-based auth once deployed, so I rebuilt it as a full-page redirect instead.

Calendar-recurrence math, XP leveling, and the debt-simplification logic are all pure functions with no dependency on Express or the database, which is what made it possible to actually unit test them with Jest.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.js       # Express routes
│   │   └── lib/           # Tested logic
│   │       ├── dates.js
│   │       ├── gamification.js
│   │       └── settleUp.js
│   └── prisma/
│       └── schema.prisma
└── mobile/
    ├── app/                # Expo Router screens
    ├── components/
    ├── context/             # Auth state
    └── constants/           # Design stuff (colors, etc.)
```

---

## Known Limitations & Future Improvements

- In-app notifications (nudges, overdue reminders, completion alerts) currently work
- Native OS push notifications — planned
- Real-time updates (WebSockets) — currently refreshes when a screen is opened, not push-based
- Migrating auth to a managed service (Supabase)
- Accessibility and dark mode features
