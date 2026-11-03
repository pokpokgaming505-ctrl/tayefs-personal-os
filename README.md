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
- Optional Gym, AI Models, and Content Studio plugins. Each package downloads from GitHub with progress, passes a checksum check, then requires a separate Add action. Manually downloaded `.json` packages can be imported.
- Android status-bar space is reserved so time, network, and battery icons do not cover the app header.
- On-device app data with JSON backup and restore.

## Plugins

Open **Plugins** and press **Install** to download a versioned package from GitHub. The app shows progress and verifies its SHA-256 checksum; after that, press **Add** to activate the feature. You can also import a package JSON file downloaded from a GitHub Release. Removing a plugin preserves its saved data.

The optional Gym plugin appears as its own page and a shortcut in Health & fitness. It includes an editable one-month calendar, recovery days, per-day exercise lists, sets/reps, checkboxes, and notes. Its sample routine is a starting template; use qualified adult supervision and stop if a movement causes pain. See [AAP strength-training guidance](https://www.healthychildren.org/English/healthy-living/sports/Pages/Strength-Training.aspx).

The **AI Models** plugin adds a general assistant and model settings. Add an OpenAI-compatible Chat Completions endpoint, model ID, and API key. Model names and endpoints are saved locally; API keys stay in memory only for the current app session and are not included in backups. The endpoint must support browser CORS. AI requests are sent only when you submit them; Gym shows a confirmation with the selected provider and health details before sending. AI does not automatically connect to other plugins: choose **Integrate AI with Gym plugin** from the Gym page.

For users under 18, the Gym AI feature does not return calorie or protein targets, weight-loss plans, or supplement instructions. It can offer general meal ideas; ask a parent or guardian and a qualified health professional for personalized nutrition advice.

**Content Studio** provides idea capture, platform/format/pillar selection, research, audience and goal notes, title options, hooks, outlines, scripts, shot lists, cover concepts, captions, hashtags, production checks, and target dates. It optionally connects to a saved model only after you select it in the plugin. Content briefs remain on-device; AI draft requests show the exact brief and ask before sending.

Plugin packages are JSON data for the app's supported adapters and cannot execute arbitrary code. Current independent plugin tags are `gym-v1.1.0`, `ai-models-v1.1.0`, and `content-studio-v1.0.0`. Older app and plugin releases remain available in GitHub history.

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
