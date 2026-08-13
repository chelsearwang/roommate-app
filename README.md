# RoomManager

A full-stack mobile app that helps roommates coordinate chores, split expenses, and stay in sync.

**🔗 Live app:** [roommanager-kkw4.onrender.com](https://roommanager-kkw4.onrender.com)
**🔗 API:** [roommate-app-backend.onrender.com](https://roommate-app-backend.onrender.com)

> The backend is hosted on Render's free tier, which spins down after inactivity — the first load after a while may take 30–50 seconds to wake up. Everything after that is instant.

---

## What it does

- **Chores** — recurring or one-time, split fairly via automatic rotation *or* pinned permanently to one person; custom recurrence like "the 3rd Friday of every month"; overdue tracking that keeps a missed chore visible until it's actually resolved
- **Expenses** — log shared costs, automatic even-split, and a debt-simplification algorithm that finds the minimum number of payments needed to settle up the whole household
- **Announcements** — a shared household bulletin board, with pinning and resolution tracking
- **Gamification** — XP, levels, and a household-wide streak to make chores feel less like a chore
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

**Chore rotation with time-driven catch-up.** Rotation advances based on due dates passing, not task completion — checked whenever the app is opened (no cron job needed). A `while` loop can fast-forward through multiple missed cycles in one check.

**Debt-simplification for expenses.** The settle-up algorithm nets everyone's overall balance and greedily matches debtors to creditors — minimizing the total number of real payments needed.

**Custom recurrence scheduling.** Chores support patterns like "the 3rd Friday of every month" — including deriving that pattern automatically just from tapping a date on a calendar, with correct handling of the edge case where a month has a 5th occurrence of a weekday (which doesn't exist in every month).

**Real, working OAuth on web.** The web sign-in flow was rebuilt from a popup-based approach to a full-page redirect after discovering that Google's own login pages set a strict `Cross-Origin-Opener-Policy` header, which breaks popup-based auth once deployed.

**Server-side authorization on every mutating route.** The frontend hiding a button (e.g., "Nudge" only shows for someone else's chore) is a UX nicety, never the actual security boundary — every route independently re-verifies household membership and, where relevant, resource ownership, server-side.

**Deliberately testable business logic.** Calendar-recurrence math, XP leveling, and the debt-simplification algorithm are extracted into pure functions, independent of Express or the database — covered by Jest unit tests.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.js       # Express routes
│   │   └── lib/           # Pure, tested business logic
│   │       ├── dates.js
│   │       ├── gamification.js
│   │       └── settleUp.js
│   └── prisma/
│       └── schema.prisma
└── mobile/
    ├── app/                # Expo Router screens
    ├── components/
    ├── context/             # Auth state
    └── constants/           # Design system (colors, spacing)
```

---

## Known Limitations & Future Improvements

- In-app notifications (nudges, overdue reminders, completion alerts) — fully working
- Native OS push notifications — planned; in-app notifications cover the same events today
- Real-time updates (WebSockets) — currently refreshes when a screen is opened, not push-based
- Migrating auth to a managed service (Supabase) for real token refresh — current JWTs expire after 7 days with no renewal
- Accessibility pass (screen-reader labels on icon-only buttons)
- Dark mode — a full color palette is designed and ready, not yet wired to a theme toggle
