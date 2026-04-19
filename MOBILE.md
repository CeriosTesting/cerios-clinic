# Patient Mobile App (Android)

The patient mobile app is a React Native Android app. **The backend services must be running first** (see the [Quick Start](README.md#quick-start-pre-built-images--no-clone-needed) section in the README).

---

## Download the pre-built APK

If you just want to install the app without building it yourself:

1. Go to the GitHub repository → **Actions** tab → **Build Mobile APK** workflow.
2. Click the latest successful run.
3. Download the **cerios-patient-mobile** artifact (a `.zip` containing the APK).
4. Extract the `.zip` and transfer `app-release.apk` to your Android device (e.g. via USB, email, or cloud storage).
5. On the device, open the APK file and allow installation from unknown sources when prompted.
6. Open the **Cerios Patient** app and sign in (see [Test Accounts](README.md#test-accounts)).

> The APK is configured for the Android emulator by default (`10.0.2.2` as the host address). To use it on a physical device, the backend must be reachable from the device's network — this requires building from source with the LAN profile (see below).

---

## Building from source

Follow the steps below if you need a custom build (e.g. for a physical device on your network).

### Prerequisites

1. **Node.js 22+** and **pnpm** — See [DEVELOPMENT.md](DEVELOPMENT.md) for installation.
   **pnpm** is not bundled with Node.js. If `pnpm` is not recognised, install it with:
   ```bash
   npm install -g pnpm
   ```
   Or, on Node.js 16.13+, enable it via Corepack (ships with Node):
   ```bash
   corepack enable
   ```
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

---

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

All patient test accounts are listed in the [Test Accounts](README.md#test-accounts) section in the README.

---

## Rebuilding after code changes

```bash
pnpm run mobile:release:install
```

To do a clean rebuild (if you hit build errors):

```bash
pnpm run mobile:release:clean
```

---

## Troubleshooting

| Problem                         | Solution                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SDK location not found`        | Run `pnpm run mobile:setup` or create `apps/patient-mobile/android/local.properties` manually                          |
| CMake errors with stale cache   | Delete `apps/patient-mobile/android/app/.cxx`, `app/build`, and `android/build` folders, then rebuild                  |
| `adb devices` shows nothing     | Check USB cable, enable USB Debugging on device, or start the emulator                                                 |
| App cannot reach API / Keycloak | Verify Docker services are running and `.env` has the correct IP (`10.0.2.2` for emulator, LAN IP for physical device) |
| Concurrent Gradle build error   | Close Android Studio or wait for its build to finish before running CLI builds                                         |
