# HydroTek Web App

Next.js 15 dashboard for the HydroTek ESP32 hydroponics controller: device pairing, telemetry history, and device configuration.

## Features

- **Password authentication**: Register and login with email + password (Credentials provider, bcrypt); no OAuth.
- **Dashboard**: Device tabs, telemetry chart (temperature, humidity, flow) or table view, time range selector (1h / 12h / 24h / 30d), status pills for lamp, pump, floats, and alarm from latest telemetry.
- **Device management**: Add device (navbar) → modal; per-device settings (cog) → form-based config (no raw JSON), config sync state (pending / success / device), remove device.
- **Device APIs**: Time sync, pairing (request code, confirm in app, device polls status), telemetry ingest, config GET/PATCH, and device-notified config/changed.

## Tech stack

- **Framework**: Next.js 15 (App Router)
- **Auth**: NextAuth.js v4, Credentials provider, bcrypt
- **Database**: PostgreSQL (Neon), Drizzle ORM, `drizzle-kit` migrations
- **Styling**: Tailwind CSS, custom tokens (e.g. `surface-card`), responsive layout

## Getting started

### Prerequisites

- Node.js 18+ and pnpm
- Neon (or any) PostgreSQL database

### Environment

Copy `.env.example` to `.env.local` and set:

```bash
# Database (Neon connection string)
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
```

No Google or other OAuth env vars are required.

### Install and run

```bash
pnpm install
pnpm exec drizzle-kit generate   # if schema changed
pnpm exec drizzle-kit migrate     # apply migrations
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Register a user, then log in to use the dashboard.

## Database

Schema is in `src/db/schema.ts`. Main tables: users (with `passwordHash`), devices, device_pairings, telemetry_events (includes alarm fields), and config sync state on devices. Migrations:

```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit migrate
```

## API (app-facing)

- **Devices**: List and delete devices for the logged-in account.
- **Telemetry**: `GET` with `deviceId` and `range` (1h | 12h | 24h | 30d), time-bounded.

Device-facing endpoints (time, pairing, telemetry ingest, config) are under the same app; see the root repo README for the device API summary.

## Project layout

- `src/app/`: App Router pages (login, register, dashboard), layout, globals.
- `src/components/`: Dashboard UI (chart, table, device tabs, modals, status strip).
- `src/db/`: Drizzle schema and client.
- `src/lib/`: Auth and shared utilities.

## Contributing

1. Create a feature branch, e.g. `git checkout -b feat/some-feature`.
2. Make changes and push.
3. Open a pull request.
