# AURA Android Icon & Splash Hand-Off (for Backend A / Part 1)

These files are delivered as static assets only—no `android/` native code or Gradle files were modified here.

## Adaptive Icon Layers (`108dp` canvas, `66dp` safe zone)
Copy or convert into `android/app/src/main/res/`:

| Asset | Target location |
| :--- | :--- |
| `ic_launcher_foreground.svg` / `.png` | `res/drawable/ic_launcher_foreground.xml` (or `mipmap-xxxhdpi/ic_launcher_foreground.png`) |
| `ic_launcher_background.svg` / `.png` | `res/drawable/ic_launcher_background.xml` (or `mipmap-xxxhdpi/ic_launcher_background.png`) |
| `ic_launcher_monochrome.svg` / `.png` | `res/drawable/ic_launcher_monochrome.xml` (Android 13+ themed icon) |

In `res/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml`:
```xml
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@drawable/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
  <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
```

## Legacy Launcher PNGs
Drop directly into `android/app/src/main/res/`:
- `mipmap-mdpi/ic_launcher.png` (48×48 px)
- `mipmap-hdpi/ic_launcher.png` (72×72 px)
- `mipmap-xhdpi/ic_launcher.png` (96×96 px)
- `mipmap-xxhdpi/ic_launcher.png` (144×144 px)
- `mipmap-xxxhdpi/ic_launcher.png` (192×192 px)

## Store & Splash
- `playstore-512.png` (512×512 px) — Play Store listing icon
- `splash-2732.png` (2732×2732 px) — Capacitor splash screen (mark centred at ~25% on `#070F0D`)
