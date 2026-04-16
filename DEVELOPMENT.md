# Development Guide

This guide walks you through setting up the Clinic application for **local development** from scratch on a brand-new Windows machine. No prior experience with the tools is assumed.

> **Just want to run and test the app?** See [README.md](README.md) for the Docker-only quick start — no Node.js or other tools required.

---

## Prerequisites

Install the following tools **in order**. Each link goes to the official download page.

### Node.js (v20 LTS)

1. Go to https://nodejs.org and download the **LTS** version (20.x).
2. Run the installer. Accept all defaults.
3. Open a new terminal (PowerShell or Command Prompt) and verify:

```bash
node --version
# Should show v20.x.x

npm --version
# Should show 10.x.x
```

### pnpm (Package Manager)

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

### Docker Desktop

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

### Git

1. Go to https://git-scm.com/download/win and download the installer.
2. Run it and accept all defaults.
3. Verify:

```bash
git --version
# Should show git version 2.x.x
```

---

## Step 1 — Get the Code

Open a terminal, navigate to where you want to store the project, then clone the repository:

```bash
git clone <repository-url> clinic-monorepo
cd clinic-monorepo
```

> Replace `<repository-url>` with the actual Git URL provided to you.

---

## Step 2 — Create the Environment File

The project needs a `.env` file with configuration values. The example file contains sensible defaults for local development — just copy it:

**On Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**On Mac/Linux:**

```bash
cp .env.example .env
```

No changes are needed — the defaults work out of the box for local development.

---

## Step 3 — Install Node Dependencies

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

## Step 4 — Start the Infrastructure (Docker)

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

## Step 5 — Run Database Migrations

This creates all the tables in PostgreSQL:

```bash
pnpm run db:migrate
```

On a fresh clone this applies all existing migrations automatically without any prompts.

> If the tables already exist from a previous run you can skip this step.

> **Note:** `db:migrate` uses `prisma migrate dev`, which is **interactive** — it will prompt you to name a new migration if one is detected. To apply existing migration files non-interactively (e.g. in CI or when deploying to a shared environment), use:
>
> ```bash
> pnpm run db:migrate:deploy
> ```

---

## Step 6 — Seed the Database

This creates all the test users in both PostgreSQL and Keycloak:

```bash
pnpm run db:seed
```

The seed script creates the following accounts. Staff accounts use the password set in `SEED_STAFF_PASSWORD` (e.g., `Clinic1234!`). Patient accounts use the password set in `SEED_PATIENT_PASSWORD` (e.g., `Patient1234!`).

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

## Step 7 — Start the Web Application

Start all six web services (3 APIs + 3 frontends) with a single command:

```bash
pnpm run dev
```

Each service is colour-coded in the terminal output. You can now open:

- **Patient Portal** → http://localhost:5173
- **Doctor Portal** → http://localhost:5174
- **Assistant Portal** → http://localhost:5175

Press `Ctrl + C` to stop all services.

---

## Step 8 — Test the Native Android App (Patient Mobile, Release APK)

The patient mobile app is a React Native app that connects to the same local APIs and Keycloak as the web portals. This guide uses a **release APK flow for testing** (no Metro/dev server required).

### 8.1 — Prerequisites

Before running the app you need the Android development toolchain. If you have **Android Studio** installed this is already taken care of. For a minimal command-line-only setup:

1. **Java (JDK 17 or newer)** — Download from https://adoptium.net and install. JDK 17, 21, or 25 all work; the setup script in section 8.2 handles JDK compatibility with Gradle automatically. Verify:
   ```bash
   java -version
   # Should show your installed JDK version
   ```
2. **Android Studio** (recommended) — Download from https://developer.android.com/studio. During setup, make sure the following are installed via the SDK Manager:
   - Android SDK Platform (API 35 or higher)
   - Android SDK Build-Tools
   - Android Emulator
3. **ANDROID_HOME environment variable** — Android Studio sets this automatically. To verify:
   ```powershell
   echo $env:ANDROID_HOME
   # Should print a path like C:\Users\<you>\AppData\Local\Android\Sdk
   ```
   If it is blank, add it to your user environment variables and restart your terminal.

### 8.2 — Generate the Android Configuration File

Run the one-time setup script from the monorepo root:

```bash
pnpm run mobile:setup
```

This script:

- Detects your Android SDK location (from `ANDROID_HOME` or common install paths) and writes `apps/patient-mobile/android/local.properties`.
- Checks your JDK version. If you have JDK 22 or newer (JDK 17–21 work natively with Gradle), it locates Android Studio's bundled JBR (Java 21) and adds `org.gradle.java.home` to `~/.gradle/gradle.properties` so Gradle uses a compatible JDK automatically.

The generated `local.properties` file is git-ignored — each developer runs this once on their own machine. The `~/.gradle/gradle.properties` entry is written to your user home directory and also never touches version control.

> **Manual fallback — if the script cannot find your SDK:** Create `apps/patient-mobile/android/local.properties` by hand:
>
> ```properties
> # Windows example:
> sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
>
> # macOS example:
> # sdk.dir=/Users/<you>/Library/Android/sdk
> ```
>
> If you have JDK > 21 and the script cannot find Android Studio, add the following to `~/.gradle/gradle.properties` (create the file if it does not exist):
>
> ```properties
> # Windows — path to Android Studio's bundled JBR:
> org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
>
> # macOS:
> # org.gradle.java.home=/Applications/Android Studio.app/Contents/jbr/Contents/Home
> ```

### 8.3 — Configure the Environment File

The app reads API and Keycloak URLs from `apps/patient-mobile/.env`.

You can now generate this file automatically with a profile:

```bash
# Emulator profile (localhost on host machine via 10.0.2.2)
pnpm run mobile:env:emulator

# LAN profile (auto-detects your private IPv4)
pnpm run mobile:env:lan

# LAN profile with explicit IP override
pnpm run mobile:env:lan -- --ip=192.168.1.42
```

- Use `mobile:env:emulator` when testing on the built-in Android Emulator against local services on your machine.
- Use `mobile:env:lan` for physical devices (or emulator over Wi-Fi) on the same network.

Manual fallback (if you prefer editing `.env` yourself):

The app needs to know the IP address of your development machine so it can reach the APIs and Keycloak. A physical Android device cannot use `localhost` — it must use your machine's LAN IP address.

**Find your LAN IP:**

```powershell
ipconfig
# Look for the IPv4 address under your active network adapter, e.g. 192.168.1.42
```

Copy the example file and fill in your IP:

```powershell
Copy-Item apps/patient-mobile/.env.example apps/patient-mobile/.env
```

Then open `apps/patient-mobile/.env` and replace `LAN_IP` with your actual IP:

```env
API_URL=http://192.168.1.42:3001/api
KEYCLOAK_URL=http://192.168.1.42:8080
KEYCLOAK_REALM=clinic
KEYCLOAK_CLIENT_ID=patient-mobile-client
```

> **Android Emulator note:** If you are using the built-in Android Emulator (not a physical device), you can use `10.0.2.2` instead of your LAN IP — this is a special alias that the emulator maps to `localhost` on your host machine:
>
> ```env
> API_URL=http://10.0.2.2:3001/api
> KEYCLOAK_URL=http://10.0.2.2:8080
> ```

### 8.4 — Set Up a Device or Emulator

**Option A — Android Emulator (no physical device needed)**

1. Open Android Studio.
2. Go to **More Actions → Virtual Device Manager** (or **Device Manager** in the toolbar).
3. Click **Create Device**, pick a phone (e.g. Pixel 8), choose a system image (API 35 / Android 15), and finish.
4. Click the **Play** button to start the emulator. Wait until it finishes booting to the home screen.

**Option B — Physical Android Device**

1. On the device: go to **Settings → About phone** and tap **Build number** seven times to enable Developer Options.
2. Go to **Settings → Developer Options** and enable **USB Debugging**.
3. Connect the device to your PC via USB.
4. Accept the "Allow USB debugging from this computer?" prompt on the device.
5. Verify the device is detected:
   ```bash
   adb devices
   # Should list your device, e.g.:
   # List of devices attached
   # R58MA1XXXXX   device
   ```

### 8.5 — Build and Install the Release App (No Metro)

Make sure the web services from Step 7 are already running (the APIs must be reachable from the device).

Use two terminals:

1. Terminal A: `pnpm run dev` (keep running)
2. Terminal B: mobile build/install commands below

From the monorepo root, run:

```bash
pnpm run mobile:test:emulator
```

This is the easiest localhost emulator flow. It does two things:

1. Generates `apps/patient-mobile/.env` with emulator-safe URLs (`10.0.2.2`)
2. Runs the full release testing flow

If you already have a custom `.env` profile selected, you can run:

```bash
pnpm run mobile:test
```

This command does the full release testing flow:

1. Generates Android local configuration (`mobile:setup`)
2. Installs mobile dependencies
3. Builds and installs a **release** APK on your connected emulator/device

For subsequent runs (faster), you can use:

```bash
pnpm run mobile:release:install
```

If you only want to generate the APK file without installing:

```bash
pnpm run mobile:release
```

The generated APK is at:

```text
apps/patient-mobile/android/app/build/outputs/apk/release/app-release.apk
```

In Android Studio, open `apps/patient-mobile/android` and run the `app` module with the `release` variant.

### 8.6 — Log In to the Mobile App

The first build takes 2–5 minutes. Subsequent builds are much faster because Gradle caches the results.

> **If Android Studio is open** while running this command, make sure no Gradle sync or build is in progress in the IDE — concurrent Gradle processes can conflict.

Once the app is open:

1. Tap **Sign in with Clinic Account**.
2. The app opens the Keycloak login page in the device browser.
3. Log in with any patient account from the seed data, for example:
   - **Email:** `patient.wilson@example.com`
   - **Password:** `Patient1234!` (or the value of `SEED_PATIENT_PASSWORD` in your `.env`)
4. After login, Keycloak redirects back to the app automatically.

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

| Command                                    | Description                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm run infra:up`                        | Start Docker containers (Postgres, Keycloak, Mailpit)                                   |
| `pnpm run infra:down`                      | Stop and remove Docker containers                                                       |
| `pnpm run db:migrate`                      | Run pending migrations interactively (prompts for a name if new migrations are created) |
| `pnpm run db:migrate:deploy`               | Apply existing migration files non-interactively (safe for CI / shared environments)    |
| `pnpm run db:seed`                         | Create/reset all test users in DB and Keycloak                                          |
| `pnpm run db:reset`                        | **⚠ Drops and recreates the database** (wipes all data)                                 |
| `pnpm run db:studio`                       | Open Prisma Studio (visual DB browser) at http://localhost:5555                         |
| `pnpm run dev`                             | Start all 6 web apps in development mode (keep running while testing mobile)            |
| `pnpm run build`                           | Build all packages and apps for production                                              |
| `pnpm run typecheck`                       | Type-check all packages and apps without emitting files                                 |
| `pnpm run docker:up`                       | Build and start everything via Docker (no Node.js required for testing)                 |
| `pnpm run docker:down`                     | Stop all Docker containers (including apps)                                             |
| `pnpm run docker:reset`                    | Wipe all data and rebuild everything from scratch                                       |
| `docker logs clinic-keycloak -f`           | Stream Keycloak logs                                                                    |
| `docker logs clinic-postgres -f`           | Stream PostgreSQL logs                                                                  |
| `pnpm run mobile:setup`                    | Generate Android SDK/JDK local configuration                                            |
| `pnpm run mobile:env:emulator`             | Generate `apps/patient-mobile/.env` for emulator localhost testing (`10.0.2.2`)         |
| `pnpm run mobile:env:lan`                  | Generate `apps/patient-mobile/.env` for physical device/LAN testing                     |
| `pnpm run mobile:test`                     | One-command release testing flow (setup + install deps + install release APK)           |
| `pnpm run mobile:test:emulator`            | One-command emulator localhost release flow (env + setup + install release APK)         |
| `pnpm run mobile:release`                  | Build a release APK (no Metro required at runtime)                                      |
| `pnpm run mobile:release:install`          | Build and install release APK on connected emulator/device (no Metro required)          |
| `pnpm run mobile:release:install:emulator` | Set emulator env and install release APK                                                |

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

[← Back to README](README.md)
