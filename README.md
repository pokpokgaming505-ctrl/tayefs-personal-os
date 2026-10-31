# Northstar — Personal OS

Northstar is being built as a dedicated desktop and Android app. The shared interface is embedded inside native app shells, so using it does not require a browser tab or a hosted website.

## Download and install

Download the newest app builds from the [GitHub Releases page](https://github.com/pokpokgaming505-ctrl/northstar-personal-os/releases/latest). Older builds stay available in the [complete release history](https://github.com/pokpokgaming505-ctrl/northstar-personal-os/releases).

- **Windows:** download `Northstar-Setup-<version>.exe`, open it, and follow the installer. This build is unsigned, so Windows may show an unverified publisher message.
- **Android:** download `Northstar-Android-<version>.apk`, open it on the phone, and allow installation from that source if Android asks. This first APK is debug-signed for direct installation and is not a Play Store build.

Every published version has its own `v<version>` tag and GitHub Release. New releases add downloads without replacing earlier versions.

## Windows desktop

From this folder:

```powershell
npm install
npm start
```

If the visual assets need to be regenerated after a change, run `npm run icons` first.

Create the Windows installer with:

```powershell
npm run make:windows
```

The installer is written to `release/windows/Northstar-Setup-0.1.0.exe`. It creates Start Menu and desktop shortcuts.

## Android phone

Node.js 20+, Android Studio, Java 21, and the Android SDK are required. Create the Android project once, then build a debug APK:

```powershell
npm install
npm run android:add
npm run android:debug
```

The installable debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. It is debug-signed for direct installation. A Play Store release still needs a signing key.

## Current app features

- Daily dashboard and editable task list.
- Health check-ins for movement and rest.
- Study session log and focus timer.
- Project board, reading shelf, idea notes, and weekly review.
- Three visual styles: Focus OS, Simple life, and Creator lab.
- Local data storage and JSON backup/restore.
- Northstar icons in the Windows installer and Android launcher.

## Data

There is no account or cloud sync in this version. App data is kept on the device. Back up the data before moving to a different device or clearing app storage.

## Project layout

- `www/` — interface shared by the native apps.
- `main.cjs`, `preload.cjs` — Windows desktop app shell.
- `package.json` — Windows installer and Android build configuration.
- `scripts/generate-icons.cjs` — Windows and Android app icon generator.
- `capacitor.config.json` — Android app configuration.
- `android/` — generated native Android project after `npm run android:add`.

The app identifier is `com.northstar.lifeos`. An iPhone build needs macOS and Xcode; this project currently outputs an Android APK.

## Versioning

The app version is set in `package.json`. Use a new semantic version for each update and publish it with a matching Git tag such as `v0.1.1`; do not reuse an existing tag. Keep each version as a separate GitHub Release so its installer downloads remain available.
