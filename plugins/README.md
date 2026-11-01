# TAYEF'S plugins

This folder versions the built-in plugin catalog for TAYEF'S. Each plugin has a manifest, semantic version, and release tag. Installing a catalog entry enables that plugin in the local app; removing it hides the feature but keeps its saved data on the device.

The shared implementation is in `www/app.js` under each plugin's registered view and event handlers. Add new plugin code and manifest entries together, update `plugins/CHANGELOG.md`, then bump the app version and publish a new app release. To publish a plugin source snapshot, create a GitHub Release with the tag recorded in its manifest. Existing tags preserve older plugin snapshots.

Plugin API keys and health details must not be added to manifests, source control, app backups, or release notes. The AI Models plugin keeps keys in memory only and asks before sending a prompt or Gym profile to a configured endpoint.
