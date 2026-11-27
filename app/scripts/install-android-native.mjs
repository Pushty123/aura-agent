// Installs AURA's Android plugin into the generated (git-ignored) Android project:
//  - copies AuraNativePlugin.kt and registers it in MainActivity
//  - turns on Kotlin, adds Health Connect, raises minSdk to 26 (needed by Health Connect)
//  - adds the permissions and Health Connect entries to AndroidManifest.xml
// Safe to run many times.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
if (!existsSync(android)) {
  console.log('No android project yet. Run: npm run cap:add:android');
  process.exit(0);
}

const log = [];
const read = (p) => readFileSync(p, 'utf8');
function edit(file, fn, note) {
  if (!existsSync(file)) {
    log.push(`MISSING ${file}`);
    return;
  }
  const before = read(file);
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    log.push(`updated ${note}`);
  }
}

// 1. Plugin source + MainActivity
const pkgDir = join(android, 'app', 'src', 'main', 'java', 'in', 'phoenix', 'aura');
mkdirSync(pkgDir, { recursive: true });
for (const f of ['AuraNativePlugin.kt', 'AuraWidgetProvider.kt', 'AppLimits.kt', 'PhoneSensors.kt', 'Reminders.kt']) copyFileSync(join(root, 'native-android', f), join(pkgDir, f));
cpSync(join(root, 'native-android', 'res'), join(android, 'app', 'src', 'main', 'res'), { recursive: true });
log.push('copied AuraNativePlugin.kt, AuraWidgetProvider.kt, AppLimits.kt, PhoneSensors.kt and widget resources');
const mainActivity = `package in.phoenix.aura;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AuraNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
const mainFile = join(pkgDir, 'MainActivity.java');
if (!existsSync(mainFile) || read(mainFile) !== mainActivity) {
  writeFileSync(mainFile, mainActivity);
  log.push('wrote MainActivity.java (registers the plugin)');
}

// 2. Gradle: Kotlin, Health Connect, minSdk 26
edit(
  join(android, 'build.gradle'),
  (s) =>
    s.includes('kotlin-gradle-plugin')
      ? s
      : s.replace(/(\n\s*classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"])/, `$1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24'`),
  'build.gradle (Kotlin plugin)',
);
edit(
  join(android, 'variables.gradle'),
  (s) => s.replace(/minSdkVersion\s*=\s*(\d+)/, (m, v) => (Number(v) < 26 ? 'minSdkVersion = 26' : m)),
  'variables.gradle (minSdk 26)',
);
edit(
  join(android, 'app', 'build.gradle'),
  (s) => {
    let t = s;
    if (!t.includes("kotlin-android"))
      t = t.replace("apply plugin: 'com.android.application'", "apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'");
    if (!t.includes('kotlinOptions'))
      t = t.replace(/\n(\s*)buildTypes \{/, `\n$1kotlinOptions {\n$1    jvmTarget = '17'\n$1}\n$1buildTypes {`);
    // connect-client 1.1.0 (stable) needs compileSdk 36; 1.1.0-alpha07 works with compileSdk 34 / AGP 8.2.
    t = t.replace(/androidx\.health\.connect:connect-client:[^"']+/, 'androidx.health.connect:connect-client:1.1.0-alpha07');
    if (!t.includes('androidx.work'))
      t = t.replace(/dependencies \{/, `dependencies {\n    implementation "androidx.work:work-runtime:2.9.0"`);
    if (!t.includes('androidx.biometric'))
      t = t.replace(/dependencies \{/, `dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"`);
    if (!t.includes('connect-client'))
      t = t.replace(
        /dependencies \{/,
        `dependencies {\n    implementation "androidx.health.connect:connect-client:1.1.0-alpha07"\n    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"`,
      );
    return t;
  },
  'app/build.gradle (Kotlin, Health Connect)',
);

// 3. Manifest
edit(
  join(android, 'app', 'src', 'main', 'AndroidManifest.xml'),
  (s) => {
    let x = s;
    if (!x.includes('xmlns:tools')) x = x.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
    const perms = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.CAMERA" />',
      '<uses-permission android:name="android.permission.USE_BIOMETRIC" />',
      '<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />',
      '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
      '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
      '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
      '<uses-feature android:name="android.hardware.sensor.stepcounter" android:required="false" />',
      '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
      '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
      '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
      '<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />',
      '<uses-permission android:name="android.permission.health.READ_STEPS" />',
      '<uses-permission android:name="android.permission.health.READ_SLEEP" />',
      '<uses-permission android:name="android.permission.health.READ_HEART_RATE" />',
      '<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />',
      '<uses-permission android:name="android.permission.health.READ_EXERCISE" />',
      '<uses-feature android:name="android.hardware.camera" android:required="false" />',
      '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
    ];
    const missing = perms.filter((p) => !x.includes(p.match(/android:name="([^"]+)"/)[0]));
    if (missing.length) x = x.replace('<application', `${missing.map((p) => `    ${p}\n`).join('')}\n    <application`);
    // Lets the demo app talk to a laptop server over plain http on the local Wi-Fi.
    if (!x.includes('usesCleartextTraffic'))
      x = x.replace('<application', '<application android:usesCleartextTraffic="true"');
    // See other apps' names and icons for the App usage screen (Android 11+ package visibility).
    if (!x.includes('android.intent.category.LAUNCHER" /></intent>'))
      x = x.replace('</manifest>', `    <queries>\n        <intent><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent>\n    </queries>\n</manifest>`);
    // Voice: the phone's speech recogniser and text-to-speech engine (Android 11+ package visibility).
    if (!x.includes('android.speech.RecognitionService'))
      x = x.replace('</manifest>', `    <queries>\n        <intent><action android:name="android.speech.RecognitionService" /></intent>\n        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>\n    </queries>\n</manifest>`);
    if (!x.includes('com.google.android.apps.healthdata'))
      x = x.replace('</manifest>', `    <queries>\n        <package android:name="com.google.android.apps.healthdata" />\n    </queries>\n</manifest>`);
    // Reminder alarms and notification buttons (handled in the background, like other apps).
    x = x.replace(/\s*<receiver android:name="\.Reminder(Boot)?Receiver"[\s\S]*?<\/receiver>/g, '');
    x = x.replace(
      '</application>',
      `    <receiver android:name=".ReminderReceiver" android:exported="false" />
        <receiver android:name=".ReminderBootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>`,
    );
    // Home-screen widget. Always rewritten so older installs get the fixed entry:
    // exported + label + preview image, which Xiaomi/HyperOS launchers need to list it.
    x = x.replace(/\s*<receiver android:name="\.AuraWidgetProvider"[\s\S]*?<\/receiver>/, '');
    x = x.replace(
      '</application>',
      `    <receiver android:name=".AuraWidgetProvider" android:exported="true" android:label="AURA Balance">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/aura_widget_info" />
        </receiver>
    </application>`,
    );
    if (!x.includes('SHOW_PERMISSIONS_RATIONALE'))
      x = x.replace(
        '</application>',
        `    <activity-alias android:name="PermissionsRationaleActivity" android:exported="true" android:targetActivity=".MainActivity">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity-alias>
        <activity-alias android:name="ViewPermissionUsageActivity" android:exported="true" android:targetActivity=".MainActivity" android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
    </application>`,
      );
    return x;
  },
  'AndroidManifest.xml (permissions, Health Connect)',
);

// 4. App icon from the design hand-off (src/assets/brand/android)
const brand = join(root, 'src', 'assets', 'brand', 'android');
const res = join(android, 'app', 'src', 'main', 'res');
if (existsSync(join(brand, 'ic_launcher_foreground.png')) && existsSync(res)) {
  const nodpi = join(res, 'drawable-nodpi');
  mkdirSync(nodpi, { recursive: true });
  for (const [from, to] of [
    ['ic_launcher_foreground.png', 'aura_ic_foreground.png'],
    ['ic_launcher_background.png', 'aura_ic_background.png'],
    ['ic_launcher_monochrome.png', 'aura_ic_monochrome.png'],
  ])
    if (existsSync(join(brand, from))) copyFileSync(join(brand, from), join(nodpi, to));
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const src = join(brand, `mipmap-${d}`, 'ic_launcher.png');
    const dir = join(res, `mipmap-${d}`);
    if (existsSync(src) && existsSync(dir)) {
      copyFileSync(src, join(dir, 'ic_launcher.png'));
      copyFileSync(src, join(dir, 'ic_launcher_round.png'));
    }
  }
  const any = join(res, 'mipmap-anydpi-v26');
  mkdirSync(any, { recursive: true });
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/aura_ic_background" />
    <foreground android:drawable="@drawable/aura_ic_foreground" />
    <monochrome android:drawable="@drawable/aura_ic_monochrome" />
</adaptive-icon>
`;
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const f = join(any, name);
    if (!existsSync(f) || read(f) !== adaptive) writeFileSync(f, adaptive);
  }
  log.push('installed the AURA app icon');
}

console.log(log.length ? log.map((l) => `- ${l}`).join('\n') : 'Android project already up to date.');
