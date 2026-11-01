# TAYEF'S — Personal OS

TAYEF'S is a dedicated Windows and Android app for keeping health, study, projects, reading, and ideas together. The native app shells load the same local interface; it does not require a hosted website.

## Download and install

Get the newest builds from the [GitHub Releases page](https://github.com/pokpokgaming505-ctrl/tayefs-personal-os/releases/latest). Earlier app versions remain in [release history](https://github.com/pokpokgaming505-ctrl/tayefs-personal-os/releases).

- **Windows:** download `TAYEFS-Setup-<version>.exe` and follow the installer. The installer is unsigned, so Windows may show an unverified publisher message.
- **Android:** download `TAYEFS-Android-<version>.apk` and allow installation from that source if Android asks. Direct APKs are debug-signed and are not Play Store builds.

Each app version has a separate semantic version tag and release. Publishing a new build does not replace old downloads.

## App features

- Dashboard, movement and rest tracking, study log and focus timer, projects, reading shelf, idea notes, and weekly reflection.
- Four themes: Focus, Simple, Creator, and Bright.
- Text size and Sans, Serif, or Mono font controls in the top bar.
- Optional Gym and AI Models plugins, installed from the Plugins page.
- On-device app data with JSON backup and restore.

## Plugins

Choose **Plugins → Install plugin** to add or remove a built-in feature. The Gym plugin appears as its own page and a shortcut in Health & fitness. It includes an editable one-month calendar, recovery days, per-day exercise lists, sets/reps, checkboxes, and notes. Its sample routine is a starting template; use qualified adult supervision and stop if a movement causes pain. See [AAP strength-training guidance](https://www.healthychildren.org/English/healthy-living/sports/Pages/Strength-Training.aspx).

The **AI Models** plugin adds a general assistant and model settings. Add an OpenAI-compatible Chat Completions endpoint, model ID, and API key. Model names and endpoints are saved locally; API keys stay in memory only for the current app session and are not included in backups. The endpoint must support browser CORS. AI requests are sent only when you submit them; Gym shows a confirmation with the selected provider and health details before sending. AI does not automatically connect to other plugins: choose **Integrate AI with Gym plugin** from the Gym page.

For users under 18, the Gym AI feature does not return calorie or protein targets, weight-loss plans, or supplement instructions. It can offer general meal ideas; ask a parent or guardian and a qualified health professional for personalized nutrition advice.

Plugin manifests and release history are in `plugins/`. Current plugins have independent semantic versions and tags: `gym-v1.0.0` and `ai-models-v1.0.0`. The catalog currently ships with the app; new plugin code is delivered in a later app release, while previous app and plugin tags keep their source snapshots.

## Build from source

### Windows

```powershell
npm install
npm start
npm run icons
npm run make:windows
```

The installer is written to `release/windows/TAYEFS-Setup-<version>.exe`.

### Android

Node.js 20+, Java 21, Android Studio, and the Android SDK are required.

```powershell
npm install
npm run android:debug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Versioning and project layout

- `package.json` — app version, installer, and product name.
- `www/` — shared Windows/Android interface.
- `plugins/` — plugin manifests and plugin-specific version history.
- `main.cjs`, `preload.cjs` — Windows app shell.
- `scripts/generate-icons.cjs` — Windows and Android logo/icon generator.
- `android/` — Android native project.

The native app ID remains `com.northstar.lifeos` so the TAYEF'S APK can update an existing installation. App data remains on each device; export a backup before changing or clearing a device. An iPhone build still requires macOS and Xcode.
