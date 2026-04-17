![cerios clinic](./cerios-clinic.png)

# Clinic Monorepo

This is a full-stack clinic management application. This guide gets you up and running with **Docker only** — no Node.js or other tools required.

> **Developers**: see [DEVELOPMENT.md](DEVELOPMENT.md) for the local development setup with hot-reload.

---

## What Is This Project?

| Service              | URL                       | Description                                                                         |
| -------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| **Patient Portal**   | http://localhost:5173     | React app — patients view/book appointments                                         |
| **Doctor Portal**    | http://localhost:5174     | React app — doctors manage their schedule                                           |
| **Assistant Portal** | http://localhost:5175     | React app — reception/admin staff manage appointments                               |
| **Patient API**      | http://localhost:3001/api | NestJS backend for the Patient Portal ([Swagger](http://localhost:3001/api/docs))   |
| **Doctor API**       | http://localhost:3002/api | NestJS backend for the Doctor Portal ([Swagger](http://localhost:3002/api/docs))    |
| **Assistant API**    | http://localhost:3003/api | NestJS backend for the Assistant Portal ([Swagger](http://localhost:3003/api/docs)) |
| **Keycloak**         | http://localhost:8080     | Authentication & user management                                                    |
| **PostgreSQL**       | localhost:5432            | Database                                                                            |
| **Mailpit**          | http://localhost:8025     | Local email catcher (dev only)                                                      |

---

## Prerequisites

You only need two things installed:

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
   - After installation, **restart your computer**.
   - Open Docker Desktop and wait until it shows **"Docker Desktop is running"**.
   - Windows Home users: Docker Desktop requires WSL 2. The installer will prompt you to enable it.

2. **Git** — https://git-scm.com/download/win

Verify both are working:

```bash
docker --version
docker compose version
git --version
```

---

## Quick Start

```bash
git clone <repository-url> clinic
cd clinic
```

Then start everything:

```bash
docker compose -f infra/docker-compose.yml --profile apps up -d --build
```

> If you have **pnpm** installed (see [DEVELOPMENT.md](DEVELOPMENT.md)), you can use the shorthand: `pnpm run docker:up`

The first build takes several minutes (downloading images, installing dependencies, compiling). Subsequent runs use cached layers and start in about 10 seconds.

### What happens automatically

1. PostgreSQL, Keycloak, and Mailpit start first.
2. Once they are healthy, the **db-init** container runs database migrations and seeds test data (then exits).
3. The three API servers start after db-init completes.
4. The three frontend portals start after the APIs are healthy.

### Check the status

```bash
docker ps
```

All containers should show `Up` or `healthy`. The `clinic-db-init` container will show `Exited (0)` — that is normal (it runs once and stops).

### Open the application

- **Patient Portal** → http://localhost:5173
- **Doctor Portal** → http://localhost:5174
- **Assistant Portal** → http://localhost:5175

---

## Test Accounts

### Doctors — log in at http://localhost:5174

| Email                      | Name             | Specialty           |
| -------------------------- | ---------------- | ------------------- |
| `admin@clinic.local`       | System Admin     | Doctor + Admin role |
| `dr.smith@clinic.local`    | James Smith      | General Practice    |
| `dr.johnson@clinic.local`  | Sarah Johnson    | Cardiology          |
| `dr.williams@clinic.local` | Michael Williams | Neurology           |

> `admin@clinic.local` uses password `Admin1234!` (from `KEYCLOAK_REALM_ADMIN_PASSWORD`).
> All other staff accounts use password `Clinic1234!` (from `SEED_STAFF_PASSWORD`).

### Assistants — log in at http://localhost:5175

| Email                           | Name         | Department      |
| ------------------------------- | ------------ | --------------- |
| `assistant.brown@clinic.local`  | Emily Brown  | Reception       |
| `assistant.davis@clinic.local`  | Robert Davis | Cardiology Wing |
| `assistant.miller@clinic.local` | Lisa Miller  | Neurology Wing  |

### Patients — log in at http://localhost:5173

| Email                          | Name           |
| ------------------------------ | -------------- |
| `patient.wilson@example.com`   | Alice Wilson   |
| `patient.moore@example.com`    | Bob Moore      |
| `patient.taylor@example.com`   | Carol Taylor   |
| `patient.anderson@example.com` | David Anderson |
| `patient.thomas@example.com`   | Eva Thomas     |

> Patient accounts use password `Patient1234!` (from `SEED_PATIENT_PASSWORD`).

---

## Swagger / API Documentation

| API           | Swagger URL                    |
| ------------- | ------------------------------ |
| Patient API   | http://localhost:3001/api/docs |
| Doctor API    | http://localhost:3002/api/docs |
| Assistant API | http://localhost:3003/api/docs |

---

## Keycloak Admin Console

1. Open http://localhost:8080
2. Click **Administration Console**
3. Log in with username `admin` / password `admin_secret`
4. Select the **clinic** realm from the dropdown in the top-left corner.

---

## Mailpit (Email Catcher)

All emails sent by the application are captured locally by Mailpit. No real emails are sent.

Open http://localhost:8025 to view the inbox.

---

## Docker Commands

| Command                                                                   | Description                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `docker compose -f infra/docker-compose.yml --profile apps up -d --build` | Build and start everything                      |
| `docker compose -f infra/docker-compose.yml --profile apps up -d`         | Start everything (no rebuild)                   |
| `docker compose -f infra/docker-compose.yml --profile apps down`          | Stop and remove all containers                  |
| `docker compose -f infra/docker-compose.yml --profile apps down -v`       | Stop, remove containers **and delete all data** |
| `docker compose -f infra/docker-compose.yml --profile apps logs -f`       | Stream logs from all services                   |
| `docker logs clinic-api-patient -f`                                       | Stream logs from a specific container           |

> If you have pnpm installed, use `pnpm run docker:up`, `pnpm run docker:down`, or `pnpm run docker:reset` as shorthands.

### Resetting everything

To wipe all data (database, Keycloak users) and start fresh:

```bash
docker compose -f infra/docker-compose.yml --profile apps down -v
docker compose -f infra/docker-compose.yml --profile apps up -d --build
```

### After updating Keycloak realm configuration

Keycloak only imports `clinic-realm.json` when the realm does **not yet exist** in the database. If you pull changes that modify the realm (e.g. new clients, updated themes, changed redirect URIs), a normal `docker:up` will **not** apply them. You need to wipe Keycloak's stored data first:

```bash
# Stop all containers and delete the postgres volume (wipes Keycloak realm + all app data)
docker compose -f infra/docker-compose.yml --profile apps down -v

# Rebuild and start — realm is re-imported from clinic-realm.json, db-init re-seeds test data
docker compose -f infra/docker-compose.yml --profile apps up -d --build
```

> This is required any time `infra/keycloak/clinic-realm.json` changes — for example when Keycloak clients are added, renamed, or have their login theme updated.

---

## Troubleshooting

### "Cannot connect to Docker daemon"

Docker Desktop is not running. Open Docker Desktop from the Start Menu and wait for it to fully start before retrying.

### Keycloak never becomes healthy / stays "starting"

- Run `docker logs clinic-keycloak --tail 50` to see what is wrong.
- The most common cause is a timing issue. Run the `down` command and then `up` again and wait 2 minutes.

### A container keeps restarting

Check its logs:

```bash
docker logs <container-name> --tail 50
```

### Port already in use

Another application is using one of the required ports (3001–3003, 5173–5175, 5432, 8025, 8080). Close that application or change the port mapping in `infra/docker-compose.yml`.

### Rebuilding after code changes

```bash
docker compose -f infra/docker-compose.yml --profile apps up -d --build
```

The `--build` flag forces Docker to rebuild images. Without it, Docker uses cached images.

---

## Project Structure

```
clinic-monorepo/
├── apps/
│   ├── api-patient/      # NestJS — Patient API  (port 3001)
│   ├── api-doctor/       # NestJS — Doctor API   (port 3002)
│   ├── api-assistant/    # NestJS — Assistant API (port 3003)
│   ├── patient-portal/   # React/Vite — Patient UI  (port 5173)
│   ├── doctor-portal/    # React/Vite — Doctor UI   (port 5174)
│   ├── assistant-portal/ # React/Vite — Assistant UI (port 5175)
│   └── patient-mobile/   # React Native — Android patient app
├── packages/
│   ├── database/         # Prisma schema, migrations, seed script
│   ├── api-common/       # Shared NestJS utilities (auth, mail, etc.)
│   └── shared-types/     # TypeScript types shared across apps
├── infra/
│   ├── docker-compose.yml
│   ├── docker/           # Dockerfiles for containerised deployment
│   ├── keycloak/
│   │   └── clinic-realm.json
│   └── postgres/
│       └── init.sql
├── .env                  # Environment variables
├── .env.example
└── package.json          # Root scripts
```

---

## Patient Mobile App (Android)

The patient mobile app is a React Native Android app. Follow these steps to build and run it on an emulator or physical device. **The backend services must be running first** (see [Quick Start](#quick-start) above).

### Prerequisites

1. **Node.js 22+** and **pnpm** — See [DEVELOPMENT.md](DEVELOPMENT.md) for installation.
2. **Java (JDK 17 or newer)** — Download from https://adoptium.net. JDK 17, 21, or 25 all work. Verify:
   ```bash
   java -version
   ```
3. **Android Studio** — Download from https://developer.android.com/studio. During setup, install the following via **SDK Manager** (Settings → Languages & Frameworks → Android SDK):
   - Android SDK Platform (API 35 or higher)
   - Android SDK Build-Tools
   - Android Emulator
4. **ANDROID_HOME environment variable** — Android Studio sets this automatically. Verify:
   ```powershell
   echo $env:ANDROID_HOME
   # Should print something like C:\Users\<you>\AppData\Local\Android\Sdk
   ```
   If it is blank, add it to your user environment variables and restart your terminal.

### Step 1 — Install dependencies

From the monorepo root:

```bash
pnpm install
```

### Step 2 — Generate Android configuration

```bash
pnpm run mobile:setup
```

This detects your Android SDK and writes `apps/patient-mobile/android/local.properties`. It also patches Gradle's JDK config if your system JDK is newer than 21.

### Step 3 — Configure environment

Choose the profile that matches your setup:

**Emulator (recommended for testers):**

```bash
pnpm run mobile:env:emulator
```

This generates `apps/patient-mobile/.env` with `10.0.2.2` addresses (the emulator's alias for your host machine).

**Physical device on the same network:**

```bash
pnpm run mobile:env:lan
```

This auto-detects your LAN IP. To specify an IP manually:

```bash
pnpm run mobile:env:lan -- --ip=192.168.1.42
```

### Step 4 — Set up an emulator or device

**Option A — Android Emulator (no physical device needed)**

1. Open Android Studio.
2. Go to **More Actions → Virtual Device Manager** (or **Device Manager** in the toolbar).
3. Click **Create Device**, pick a phone (e.g. Pixel 8), choose a system image (API 35 / Android 15), and finish.
4. Click the **Play** button to start the emulator. Wait until it boots to the home screen.

**Option B — Physical Android Device**

1. On the device: go to **Settings → About phone** and tap **Build number** seven times to enable Developer Options.
2. Go to **Settings → Developer Options** and enable **USB Debugging**.
3. Connect the device to your PC via USB and accept the debugging prompt.
4. Verify the device is detected:
   ```bash
   adb devices
   ```

### Step 5 — Build and install

Make sure Docker services are running, then from the monorepo root:

**One-command emulator flow (steps 2–3 included):**

```bash
pnpm run mobile:test:emulator
```

**Or, if you already ran steps 2–3 manually:**

```bash
pnpm run mobile:release:install
```

The first build takes 2–5 minutes. Subsequent builds are much faster (Gradle caches results).

> **Tip:** If Android Studio is open, make sure no Gradle sync or build is running in the IDE — concurrent Gradle processes can conflict.

### Step 6 — Build and run from Android Studio (alternative)

Instead of using the command line, you can build directly from Android Studio:

1. Open Android Studio and select **Open** → navigate to `apps/patient-mobile/android` → click **OK**.
2. Wait for Gradle sync to finish (this may take a minute on first open).
3. In the toolbar, select your emulator or device from the device dropdown.
4. Open **Build → Select Build Variant** and choose **release** for the `:app` module.
5. Click the **Run ▶** button (or press `Shift+F10`).

### Step 7 — Log in to the app

1. Tap **Sign in with Clinic Account**.
2. The Keycloak login page opens in the device browser.
3. Log in with a patient account:
   - **Email:** `patient.wilson@example.com`
   - **Password:** `Patient1234!`
4. After login, Keycloak redirects back to the app automatically.

All patient test accounts are listed in the [Test Accounts](#test-accounts) section above.

### Rebuilding after code changes

```bash
pnpm run mobile:release:install
```

To do a clean rebuild (if you hit build errors):

```bash
pnpm run mobile:release:clean
```

### Troubleshooting

| Problem                         | Solution                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SDK location not found`        | Run `pnpm run mobile:setup` or create `apps/patient-mobile/android/local.properties` manually                          |
| CMake errors with stale cache   | Delete `apps/patient-mobile/android/app/.cxx`, `app/build`, and `android/build` folders, then rebuild                  |
| `adb devices` shows nothing     | Check USB cable, enable USB Debugging on device, or start the emulator                                                 |
| App cannot reach API / Keycloak | Verify Docker services are running and `.env` has the correct IP (`10.0.2.2` for emulator, LAN IP for physical device) |
| Concurrent Gradle build error   | Close Android Studio or wait for its build to finish before running CLI builds                                         |

---

## Developer Guide

For local development with hot-reload, IDE support, mobile app testing, API debugging, and more, see **[DEVELOPMENT.md](DEVELOPMENT.md)**.

---

## Test Automation

For obtaining API tokens and testing protected endpoints from scripts, Postman, or curl, see **[TEST-AUTOMATION.md](TEST-AUTOMATION.md)**.
