# Android native plugin (`AuraNative`)

```bash
cd app
npm run build
npm run cap:add:android     # creates app/android (git-ignored)
npm run cap:sync
npm run cap:open
```

Create `android/app/src/main/java/in/phoenix/aura/AuraNativePlugin.kt` and register it in `MainActivity` (`registerPlugin(AuraNativePlugin::class.java)` before `super.onCreate`).

```kotlin
package `in`.phoenix.aura

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.Settings
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AuraNative")
class AuraNativePlugin : Plugin() {

    private fun hasUsageAccess(): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    }

    @PluginMethod fun hasUsageAccess(call: PluginCall) {
        call.resolve(JSObject().put("granted", hasUsageAccess()))
    }

    @PluginMethod fun openUsageAccessSettings(call: PluginCall) {
        val i = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i); call.resolve()
    }

    // Returns { days: [{ date, screenMinutes, lateScreenMin }] } for the last N days.
    @PluginMethod fun getUsageStats(call: PluginCall) {
        if (!hasUsageAccess()) { call.reject("usage access not granted"); return }
        val n = call.getInt("days") ?: 7
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val out = JSArray()
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        for (d in n - 1 downTo 0) {
            val cal = java.util.Calendar.getInstance().apply {
                add(java.util.Calendar.DAY_OF_YEAR, -d)
                set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0)
                set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0)
            }
            val start = cal.timeInMillis
            val end = start + 24L * 3600 * 1000
            val total = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start, end)
                .sumOf { it.totalTimeInForeground } / 60000
            // Late screen = after 22:00. TODO: use queryEvents for an exact figure;
            // this approximation looks only at the 22:00-24:00 window.
            val late = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start + 22L * 3600 * 1000, end)
                .sumOf { it.totalTimeInForeground } / 60000
            out.put(JSObject().put("date", fmt.format(cal.time))
                .put("screenMinutes", total).put("lateScreenMin", minOf(late, 120L)))
        }
        call.resolve(JSObject().put("days", out))
    }

    @PluginMethod fun setAlarm(call: PluginCall) {
        val i = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, call.getInt("hour") ?: 7)
            .putExtra(AlarmClock.EXTRA_MINUTES, call.getInt("minute") ?: 0)
            .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label") ?: "AURA")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i); call.resolve()
    }

    @PluginMethod fun addCalendarEvent(call: PluginCall) {
        val begin = call.getLong("startMillis") ?: System.currentTimeMillis()
        val i = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, call.getString("title") ?: "AURA event")
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i); call.resolve()
    }
}
```

Alarm and calendar use system intents, so the user confirms again in the system UI. Method names match `app/src/native/bridge.ts`; keep them in sync. The late-screen figure is an approximation (see TODO); not tested on a device yet.
