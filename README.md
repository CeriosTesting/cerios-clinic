![cerios clinic](./cerios-clinic.png)

# Clinic Monorepo — Getting Started Guide

This guide walks you through setting up the Clinic application from scratch on a brand-new Windows machine. No prior experience with the tools is assumed.

---

## What Is This Project?

This is a full-stack clinic management application consisting of:

| Service              | URL                       | Description                                           |
| -------------------- | ------------------------- | ----------------------------------------------------- |
| **Patient Portal**   | http://localhost:5173     | React app — patients view/book appointments           |
| **Doctor Portal**    | http://localhost:5174     | React app — doctors manage their schedule             |
| **Assistant Portal** | http://localhost:5175     | React app — reception/admin staff manage appointments |
| **Patient API**      | http://localhost:3001/api | NestJS backend for the Patient Portal                 |
| **Doctor API**       | http://localhost:3002/api | NestJS backend for the Doctor Portal                  |
| **Assistant API**    | http://localhost:3003/api | NestJS backend for the Assistant Portal               |
| **Keycloak**         | http://localhost:8080     | Authentication & user management                      |
| **PostgreSQL**       | localhost:5432            | Database                                              |
| **Mailpit**          | http://localhost:8025     | Local email catcher (dev only)                        |

---

## Step 1 — Install Required Software

Install the following tools **in order**. Each link goes to the official download page.

### 1.1 Node.js (v20 LTS)

1. Go to https://nodejs.org and download the **LTS** version (20.x).
2. Run the installer. Accept all defaults.
3. Open a new terminal (PowerShell or Command Prompt) and verify:

```bash
node --version
# Should show v20.x.x

npm --version
# Should show 10.x.x
```

### 1.2 pnpm (Package Manager)

This project uses `pnpm` instead of `npm` because it is faster and shares packages across workspaces.

Open a terminal and run:

```bash
npm install -g pnpm
```

Verify:

```bash
pnpm --version
# Should show 9.x.x or higher
```

### 1.3 Docker Desktop

1. Go to https://www.docker.com/products/docker-desktop/ and download **Docker Desktop for Windows**.
2. Run the installer. Accept all defaults.
3. After installation, **restart your computer**.
4. Open Docker Desktop and wait until it shows **"Docker Desktop is running"** (the whale icon in the system tray is steady).
5. Verify in a terminal:

```bash
docker --version
# Should show Docker version 25.x.x or higher

docker compose version
# Should show Docker Compose version v2.x.x
```

> **Note for Windows Home users:** Docker Desktop requires WSL 2 (Windows Subsystem for Linux). The installer will prompt you to enable it automatically. Follow those prompts if they appear, then restart when asked.

### 1.4 Git

1. Go to https://git-scm.com/download/win and download the installer.
2. Run it and accept all defaults.
3. Verify:

```bash
git --version
# Should show git version 2.x.x
```

---

## Step 2 — Get the Code

Open a terminal, navigate to where you want to store the project, then clone the repository:

```bash
git clone <repository-url> clinic-monorepo
cd clinic-monorepo
```

> Replace `<repository-url>` with the actual Git URL provided to you.

---

## Step 3 — Create the Environment File

The project needs a `.env` file with configuration values. An example is provided:

**On Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**On Mac/Linux:**

```bash
cp .env.example .env
```

Now open `.env` in any text editor (Notepad is fine) and replace every `change_me` with real values. For a local development setup you can use simple passwords — nothing is exposed to the internet:

```env
# ── PostgreSQL ──────────────────────────────────────────────
POSTGRES_USER=clinic
POSTGRES_PASSWORD=clinic_secret
POSTGRES_DB=clinic_db
DATABASE_URL="postgresql://clinic:clinic_secret@localhost:5432/clinic_db"

# ── Keycloak ─────────────────────────────────────────────────
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin_secret
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=clinic

# ── Keycloak clients ─────────────────────────────────────────
KEYCLOAK_PATIENT_CLIENT_ID=patient-portal-client
KEYCLOAK_STAFF_CLIENT_ID=staff-portal-client
KEYCLOAK_ADMIN_CLIENT_ID=api-service-client
KEYCLOAK_ADMIN_CLIENT_SECRET=api_service_secret_change_in_prod

# ── Frontend (Vite) ─────────────────────────────────────────
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=clinic
VITE_PATIENT_KEYCLOAK_CLIENT_ID=patient-portal-client
VITE_STAFF_KEYCLOAK_CLIENT_ID=staff-portal-client
VITE_PATIENT_API_BASE_URL=http://localhost:3001/api
VITE_DOCTOR_API_BASE_URL=http://localhost:3002/api
VITE_ASSISTANT_API_BASE_URL=http://localhost:3003/api

# ── CORS ─────────────────────────────────────────────────────
API_PATIENT_CORS_ORIGINS=http://localhost:5173
API_DOCTOR_CORS_ORIGINS=http://localhost:5174
API_ASSISTANT_CORS_ORIGINS=http://localhost:5175

# ── Seed ─────────────────────────────────────────────────────
SEED_STAFF_PASSWORD=Staff1234!
SEED_PATIENT_PASSWORD=Patient1234!

# ── Keycloak realm admin account ──────────────────────────────
KEYCLOAK_REALM_ADMIN_EMAIL=admin@clinic.local
KEYCLOAK_REALM_ADMIN_PASSWORD=Admin1234!
```

> **Important:** The value for `KEYCLOAK_ADMIN_CLIENT_SECRET` must match the `secret` field in `infra/keycloak/clinic-realm.json` (`api_service_secret_change_in_prod` by default). Do not change one without changing the other.

---

## Step 4 — Install Node Dependencies

From the root of the project, run:

```bash
pnpm install
```

This installs packages for all apps and packages in the monorepo at once. It may take a few minutes the first time.

As part of the install, `prisma generate` runs automatically (via a `postinstall` hook) to generate the Prisma client types.

### Building packages for VS Code IntelliSense

The NestJS apps resolve shared packages via their compiled output (`dist/`). Run this once after a fresh clone so the TypeScript language service in VS Code works correctly:

```bash
pnpm run build
```

This builds packages first, then apps — in the correct order. It is also used for production builds.

> This is only needed for IDE type-checking. `pnpm run dev` works correctly without it.

---

## Step 5 — Start the Infrastructure (Docker)

This starts PostgreSQL, Keycloak, and Mailpit inside Docker containers.

```bash
pnpm run infra:up
```

You should see output like:

```
✔ Container clinic-postgres   Started
✔ Container clinic-keycloak   Started
✔ Container clinic-mailpit    Started
```

### Wait for Keycloak to be ready

Keycloak takes about **60–120 seconds** to start the very first time because it imports the realm configuration and sets up its database tables.

Check that it is ready by opening http://localhost:8080 in a browser. You should see the Keycloak welcome page.

Alternatively, check the container status:

```bash
docker ps
# Look for clinic-keycloak — the STATUS column should show "healthy"
```

> **If Keycloak never becomes healthy:** Check the logs with `docker logs clinic-keycloak --tail 50`. A common cause is that the database was not yet ready when Keycloak tried to connect. Run `pnpm run infra:down` and then `pnpm run infra:up` again to restart everything cleanly.

---

## Step 6 — Run Database Migrations

This creates all the tables in PostgreSQL:

```bash
pnpm run db:migrate
```

On a fresh clone this applies all existing migrations automatically without any prompts.

> If the tables already exist from a previous run you can skip this step.

---

## Step 7 — Seed the Database

This creates all the test users in both PostgreSQL and Keycloak:

```bash
pnpm run db:seed
```

The seed script creates the following accounts. Staff accounts use the password set in `SEED_STAFF_PASSWORD` (e.g., `Staff1234!`). Patient accounts use the password set in `SEED_PATIENT_PASSWORD` (e.g., `Patient1234!`).

#### Doctors — log in at http://localhost:5174

| Email                      | Name             | Specialty           |
| -------------------------- | ---------------- | ------------------- |
| `admin@clinic.local`       | System Admin     | Doctor + Admin role |
| `dr.smith@clinic.local`    | James Smith      | General Practice    |
| `dr.johnson@clinic.local`  | Sarah Johnson    | Cardiology          |
| `dr.williams@clinic.local` | Michael Williams | Neurology           |

> The `admin@clinic.local` account's password is set in `KEYCLOAK_REALM_ADMIN_PASSWORD` (default: `Admin1234!`), not in `SEED_STAFF_PASSWORD`.

#### Assistants — log in at http://localhost:5175

| Email                           | Name         | Department      |
| ------------------------------- | ------------ | --------------- |
| `assistant.brown@clinic.local`  | Emily Brown  | Reception       |
| `assistant.davis@clinic.local`  | Robert Davis | Cardiology Wing |
| `assistant.miller@clinic.local` | Lisa Miller  | Neurology Wing  |

#### Patients — log in at http://localhost:5173

| Email                          | Name           |
| ------------------------------ | -------------- |
| `patient.wilson@example.com`   | Alice Wilson   |
| `patient.moore@example.com`    | Bob Moore      |
| `patient.taylor@example.com`   | Carol Taylor   |
| `patient.anderson@example.com` | David Anderson |
| `patient.thomas@example.com`   | Eva Thomas     |

> Patient accounts use the password set in `SEED_PATIENT_PASSWORD` (default: `Patient1234!`). They can be used with `api-service-client` direct grant to test the Patient API.

### Resetting the database

To wipe all data and start fresh, run these three commands in order:

```bash
pnpm run db:reset    # ⚠ Drops and recreates the database — all data is lost
pnpm run db:migrate  # Re-applies all migrations to recreate the tables
pnpm run db:seed     # Re-creates all test users in PostgreSQL and Keycloak
```

> `db:reset` only affects PostgreSQL. If Keycloak already has the seed users from a previous run, `db:seed` may fail with "user already exists". In that case, delete the conflicting users in the [Keycloak admin console](http://localhost:8080) first, or re-run `pnpm run infra:down && pnpm run infra:up` to reset Keycloak as well (this wipes its database too).

---

## Step 8 — Start the Application

Start all six services (3 APIs + 3 frontends) with a single command:

```bash
pnpm run dev
```

Each service is colour-coded in the terminal output. You can now open:

- **Patient Portal** → http://localhost:5173
- **Doctor Portal** → http://localhost:5174
- **Assistant Portal** → http://localhost:5175

Press `Ctrl + C` to stop all services.

---

## Swagger / API Documentation

Each API has built-in Swagger UI for exploring endpoints:

| API           | Swagger URL                    |
| ------------- | ------------------------------ |
| Patient API   | http://localhost:3001/api/docs |
| Doctor API    | http://localhost:3002/api/docs |
| Assistant API | http://localhost:3003/api/docs |

To test authenticated endpoints in Swagger you need a Bearer token — see the next section.

---

## Getting a Bearer Token for API Testing

All three APIs are protected by Keycloak-issued JWT tokens. To call protected endpoints (e.g. from Swagger, Postman, or curl) you need to obtain a token first.

The easiest method for API testing is the **Resource Owner Password Credentials** (direct grant) flow against the `api-service-client`.

> **Note:** The staff portals (`staff-portal-client`) and patient portal (`patient-portal-client`) are configured as public PKCE clients and **do not support** the direct grant flow. Use `api-service-client` for programmatic token requests.

### Option A — Using curl

Open a terminal and run the following command. Replace `<email>` and `<password>` with a valid test account:

```bash
curl -s -X POST "http://localhost:8080/realms/clinic/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=api-service-client" \
  -d "client_secret=api_service_secret_change_in_prod" \
  -d "username=dr.smith@clinic.local" \
  -d "password=Staff1234!" \
  -d "scope=openid"
```

For a patient token, use a patient account and `SEED_PATIENT_PASSWORD`:

```bash
curl -s -X POST "http://localhost:8080/realms/clinic/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=api-service-client" \
  -d "client_secret=api_service_secret_change_in_prod" \
  -d "username=patient.wilson@example.com" \
  -d "password=Patient1234!" \
  -d "scope=openid"
```

The response is a JSON object. Copy the `access_token` value — it is the Bearer token.

**Example response (truncated):**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6...",
  "expires_in": 300,
  "token_type": "Bearer",
  ...
}
```

> **Windows PowerShell alternative** (no curl installed):
>
> ```powershell
> $body = @{
>     grant_type    = "password"
>     client_id     = "api-service-client"
>     client_secret = "api_service_secret_change_in_prod"
>     username      = "dr.smith@clinic.local"
>     password      = "Staff1234!"
>     scope         = "openid"
> }
> $r = Invoke-RestMethod -Method Post `
>     -Uri "http://localhost:8080/realms/clinic/protocol/openid-connect/token" `
>     -ContentType "application/x-www-form-urlencoded" `
>     -Body $body
> $r.access_token
> ```
>
> For a patient token, swap the username/password:
>
> ```powershell
> $body = @{
>     grant_type    = "password"
>     client_id     = "api-service-client"
>     client_secret = "api_service_secret_change_in_prod"
>     username      = "patient.wilson@example.com"
>     password      = "Patient1234!"
>     scope         = "openid"
> }
> $r = Invoke-RestMethod -Method Post `
>     -Uri "http://localhost:8080/realms/clinic/protocol/openid-connect/token" `
>     -ContentType "application/x-www-form-urlencoded" `
>     -Body $body
> $r.access_token
> ```

### Option B — Using Postman

1. Open Postman and create a new **POST** request.
2. Set the URL to:
   ```
   http://localhost:8080/realms/clinic/protocol/openid-connect/token
   ```
3. Under the **Body** tab, select **x-www-form-urlencoded** and add these key/value pairs:

| Key             | Value                               |
| --------------- | ----------------------------------- |
| `grant_type`    | `password`                          |
| `client_id`     | `api-service-client`                |
| `client_secret` | `api_service_secret_change_in_prod` |
| `username`      | `dr.smith@clinic.local`             |
| `password`      | `Staff1234!`                        |
| `scope`         | `openid`                            |

4. Click **Send**. Copy the `access_token` from the response.

### Option C — Using Swagger UI

1. Get a token using Option A or B above.
2. Open Swagger (e.g., http://localhost:3002/api/docs for the Doctor API).
3. Click the **Authorize** button (padlock icon, top right).
4. Paste the token into the **Value** field (no need to type "Bearer " — Swagger adds it automatically).
5. Click **Authorize**, then **Close**.
6. All subsequent requests from Swagger will include the token automatically.

### Which Token to Use for Which API?

A token embeds the user's roles. The APIs enforce the following:

| API                     | Required Role          |
| ----------------------- | ---------------------- |
| Patient API (`:3001`)   | `patient`              |
| Doctor API (`:3002`)    | `doctor` or `admin`    |
| Assistant API (`:3003`) | `assistant` or `admin` |

Use an account that has the right role:

- **Patient endpoints** → use `patient.wilson@example.com` (role: `patient`, password: `SEED_PATIENT_PASSWORD`)
- **Doctor endpoints** → use `dr.smith@clinic.local` (role: `doctor`)
- **Assistant endpoints** → use `assistant.brown@clinic.local` (role: `assistant`)
- **All endpoints** → use `admin@clinic.local` (roles: `doctor` + `admin`)

Tokens are valid for **5 minutes** by default. Request a new one when it expires.

---

## Keycloak Admin Console

To manage users, roles, and clients directly:

1. Open http://localhost:8080
2. Click **Administration Console**
3. Log in with:
   - **Username:** `admin` (or the value of `KEYCLOAK_ADMIN_USER` in your `.env`)
   - **Password:** `admin_secret` (or the value of `KEYCLOAK_ADMIN_PASSWORD` in your `.env`)
4. Select the **clinic** realm from the dropdown in the top-left corner.

---

## Mailpit (Email Catcher)

All emails sent by the application (password resets, etc.) are captured locally by Mailpit. No real emails are sent.

Open http://localhost:8025 to view the inbox.

---

## Useful Commands

| Command                          | Description                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| `pnpm run infra:up`              | Start Docker containers (Postgres, Keycloak, Mailpit)           |
| `pnpm run infra:down`            | Stop and remove Docker containers                               |
| `pnpm run db:migrate`            | Run any pending database migrations                             |
| `pnpm run db:seed`               | Create/reset all test users in DB and Keycloak                  |
| `pnpm run db:reset`              | **⚠ Drops and recreates the database** (wipes all data)         |
| `pnpm run db:studio`             | Open Prisma Studio (visual DB browser) at http://localhost:5555 |
| `pnpm run dev`                   | Start all 6 apps in development mode                            |
| `pnpm run build`                 | Build all packages and apps for production                      |
| `pnpm run typecheck`             | Type-check all packages and apps without emitting files         |
| `docker logs clinic-keycloak -f` | Stream Keycloak logs                                            |
| `docker logs clinic-postgres -f` | Stream PostgreSQL logs                                          |

---

## Troubleshooting

### "pnpm: command not found"

You need to install pnpm. Run `npm install -g pnpm` and open a new terminal window.

### "Cannot connect to Docker daemon"

Docker Desktop is not running. Open Docker Desktop from the Start Menu and wait for it to fully start before retrying.

### Keycloak never becomes healthy / stays "starting"

- Run `docker logs clinic-keycloak --tail 50` to see what is wrong.
- The most common cause is a timing issue. Run `pnpm run infra:down` then `pnpm run infra:up` and wait 2 minutes.

### "Database connection refused" or Prisma errors

- Make sure the Docker containers are running: `docker ps`
- Make sure the `DATABASE_URL` in your `.env` file matches the `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values.

### Token request fails with "401 Unauthorized" or "invalid_client"

- Double-check that `client_secret` in your token request matches `KEYCLOAK_ADMIN_CLIENT_SECRET` in `.env` and `api_service_secret_change_in_prod` in `infra/keycloak/clinic-realm.json`.
- Make sure you are targeting the `api-service-client` and not `patient-portal-client` or `staff-portal-client` (those do not support direct grant).

### Port already in use

The `pnpm run dev` command automatically kills processes on ports 3001, 3002, 3003, 5173, 5174, and 5175 before starting. If that fails, you can free them manually:

```bash
# Windows PowerShell — find and kill a process on port 3001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

### Seeding fails with "user already exists"

The seed script is idempotent for the database but may fail if Keycloak already has the user. Either re-run after a fresh `db:reset`, or delete the conflicting user in the Keycloak admin console first.

---

## Project Structure Overview

```
clinic-monorepo/
├── apps/
│   ├── api-patient/      # NestJS — Patient API  (port 3001)
│   ├── api-doctor/       # NestJS — Doctor API   (port 3002)
│   ├── api-assistant/    # NestJS — Assistant API (port 3003)
│   ├── patient-portal/   # React/Vite — Patient UI  (port 5173)
│   ├── doctor-portal/    # React/Vite — Doctor UI   (port 5174)
│   └── assistant-portal/ # React/Vite — Assistant UI (port 5175)
├── packages/
│   ├── database/         # Prisma schema, migrations, seed script
│   └── shared-types/     # TypeScript types shared across apps
├── infra/
│   ├── docker-compose.yml
│   ├── keycloak/
│   │   └── clinic-realm.json  # Auto-imported realm config
│   └── postgres/
│       └── init.sql
├── .env.example          # Copy this to .env
└── package.json          # Root scripts (dev, build, infra:*, db:*)
```
