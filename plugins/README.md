# TAYEF'S plugins

Each plugin has a versioned, JSON-only package in its own folder. `catalog.json` lists current versions and SHA-256 checksums. The app reads that catalog from GitHub, downloads a package when **Install** is pressed, shows progress, verifies its checksum, then enables a separate **Add** action. Users may also download a release asset and import its `.json` package from Plugins.

The v0.3 app supports the `gym`, `ai-models`, and `content-studio` feature adapters. Packages supply configuration and templates to those adapters; they are data files and cannot execute arbitrary JavaScript. A brand-new adapter requires an app code change and a new app release. An imported package must target an adapter supported by the installed app.

## Publishing a plugin version

1. Update the plugin's `package.json`, `manifest.json`, and changelog entry with a new semantic version and matching release tag (for example `content-studio-v1.0.1`).
2. Create a GitHub Release with that tag and attach the plugin's `package.json` as a downloadable JSON asset.
3. Calculate the package SHA-256 and update its entry in `catalog.json` plus the bundled fallback version/checksum in `www/app.js`.
4. Commit and push the catalog and app fallback update. Older plugin tags and release assets stay available.

App releases and plugin releases use separate ordered tags, so older app installers/APKs and plugin packages remain in release history.

Never include API keys, personal health details, or private creator drafts in packages, manifests, source control, shared backups, or release notes. AI keys remain in memory for one app session. AI requests occur only when the user submits them; plugin integrations are selected separately.
