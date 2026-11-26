# Android native plugin (`AuraNative`)

The Android project (`app/android`) is generated and git-ignored. The plugin source lives in the repo at
`app/native-android/AuraNativePlugin.kt`, and one command installs it:

```bash
cd app
npm install
npm run cap:add:android      # first time only: creates app/android
npm run android:prepare      # build, cap sync, add permissions, install the plugin
npm run cap:open             # opens Android Studio, then press Run
```

`android:prepare` is safe to repeat. It (see `scripts/install-android-native.mjs`):
- copies `AuraNativePlugin.kt` and registers it in `MainActivity`
- turns on Kotlin, adds the Health Connect library, raises `minSdk` to 26
- adds the camera, usage-access and Health Connect (read steps, sleep, heart rate, exercise) permissions and
  the Health Connect rationale entries to `AndroidManifest.xml`

## What the plugin does
| Method | Purpose |
|---|---|
| `hasUsageAccess`, `openUsageAccessSettings`, `getUsageStats` | Screen time per day and late-night use (23:00 to 04:00), computed exactly from usage events |
| `healthStatus`, `requestHealthPermissions`, `openHealthConnect`, `getHealthData` | Steps, sleep, heart rate and exercise from **any app that writes to Health Connect** (any band whose app shares there), with the source app named |
| `setAlarm`, `addCalendarEvent` | Opens the system alarm / calendar screens (the user confirms again there) |

Method names must match `app/src/native/bridge.ts`. Android does not let one app read another app's private files,
so band data comes via Health Connect. Bands whose app cannot share to Health Connect can export a file, which the
CSV import in My Data accepts.

## Honest status
Written and checked against a generated Capacitor 6 project, but **not yet run on a physical device**. Health Connect
returns about 30 days of history at most, and usage events about the last 7 to 10 days.
