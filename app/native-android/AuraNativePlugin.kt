package `in`.phoenix.aura

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

/**
 * AURA's bridge to Android. Everything here runs on the phone; data is returned
 * to the app, which stores it encrypted. Method names must match
 * app/src/native/bridge.ts.
 */
@CapacitorPlugin(name = "AuraNative")
class AuraNativePlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO)
    private val zone: ZoneId get() = ZoneId.systemDefault()

    // ---------------------------------------------------------------- screen time

    private fun usageAllowed(): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return ops.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName
        ) == AppOpsManager.MODE_ALLOWED
    }

    @PluginMethod
    fun hasUsageAccess(call: PluginCall) {
        call.resolve(JSObject().put("granted", usageAllowed()))
    }

    @PluginMethod
    fun openUsageAccessSettings(call: PluginCall) {
        val i = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
        call.resolve()
    }

    /** Milliseconds any app was in the foreground between start and end (exact, from usage events). */
    private fun foregroundMillis(usm: UsageStatsManager, start: Long, end: Long): Long {
        val events = usm.queryEvents(start, end)
        val ev = UsageEvents.Event()
        val resumedAt = HashMap<String, Long>()
        var total = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val pkg = ev.packageName ?: continue
            when (ev.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> resumedAt[pkg] = ev.timeStamp
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
                    val t = resumedAt.remove(pkg)
                    if (t != null && ev.timeStamp > t) total += ev.timeStamp - t
                }
            }
        }
        // An app still open at the end of the window counts up to the end.
        for (t in resumedAt.values) if (end > t) total += end - t
        return total
    }

    /**
     * { days: [{ date, screenMinutes, lateScreenMin }] } for the last N days.
     * screenMinutes: whole day. lateScreenMin: 23:00 the evening before until 04:00 that morning.
     */
    @PluginMethod
    fun getUsageStats(call: PluginCall) {
        if (!usageAllowed()) { call.reject("usage access not granted"); return }
        val n = (call.getInt("days") ?: 7).coerceIn(1, 30)
        scope.launch {
            try {
                val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val today = LocalDate.now(zone)
                val out = JSArray()
                for (back in n - 1 downTo 0) {
                    val d = today.minusDays(back.toLong())
                    val dayStart = d.atStartOfDay(zone).toInstant().toEpochMilli()
                    val dayEnd = minOf(d.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(), System.currentTimeMillis())
                    val lateStart = d.minusDays(1).atTime(23, 0).atZone(zone).toInstant().toEpochMilli()
                    val lateEnd = d.atTime(4, 0).atZone(zone).toInstant().toEpochMilli()
                    val screen = foregroundMillis(usm, dayStart, dayEnd) / 60000
                    val late = foregroundMillis(usm, lateStart, minOf(lateEnd, System.currentTimeMillis())) / 60000
                    out.put(
                        JSObject().put("date", d.toString())
                            .put("screenMinutes", screen)
                            .put("lateScreenMin", late)
                    )
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) {
                call.reject("could not read usage stats")
            }
        }
    }

    // ------------------------------------------------------------- Health Connect

    private val healthPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    private fun healthClient(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context) else null

    /** { status: "available" | "needs-update" | "unavailable", granted: boolean } */
    @PluginMethod
    fun healthStatus(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needs-update"
            else -> "unavailable"
        }
        val client = healthClient()
        if (client == null) {
            call.resolve(JSObject().put("status", status).put("granted", false))
            return
        }
        scope.launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(healthPermissions)
            } catch (e: Exception) { false }
            call.resolve(JSObject().put("status", status).put("granted", granted))
        }
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        if (healthClient() == null) { call.reject("Health Connect is not available"); return }
        val intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(context, healthPermissions)
        startActivityForResult(call, intent, "healthPermissionResult")
    }

    @ActivityCallback
    private fun healthPermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val client = healthClient()
        if (client == null) { call.resolve(JSObject().put("granted", false)); return }
        scope.launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(healthPermissions)
            } catch (e: Exception) { false }
            call.resolve(JSObject().put("granted", granted))
        }
    }

    /** Opens the Health Connect app (or the Play Store page if it must be installed or updated). */
    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        val action = if (android.os.Build.VERSION.SDK_INT >= 34)
            "android.health.connect.action.HEALTH_HOME_SETTINGS" else HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS
        try {
            context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            val store = Intent(
                Intent.ACTION_VIEW,
                android.net.Uri.parse("market://details?id=com.google.android.apps.healthdata")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try { context.startActivity(store) } catch (_: Exception) { call.reject("could not open Health Connect"); return }
        }
        call.resolve()
    }

    /**
     * { days: [{ date, steps?, sleepMinutes?, avgHeartRate?, exerciseMinutes?,
     *            origins: { steps: [pkg], sleep: [pkg], heartRate: [pkg], exercise: [pkg] } }] }
     * Health Connect removes double counting between apps for us (aggregate).
     * Sleep for a date is the night that ENDS on that date (18:00 the evening before until 12:00).
     */
    @PluginMethod
    fun getHealthData(call: PluginCall) {
        val client = healthClient()
        if (client == null) { call.reject("Health Connect is not available"); return }
        val n = (call.getInt("days") ?: 7).coerceIn(1, 30)
        scope.launch {
            try {
                if (!client.permissionController.getGrantedPermissions().containsAll(healthPermissions)) {
                    call.reject("health permissions not granted"); return@launch
                }
                val today = LocalDate.now(zone)
                val out = JSArray()
                for (back in n - 1 downTo 0) {
                    val d = today.minusDays(back.toLong())
                    val dayStart = d.atStartOfDay(zone).toInstant()
                    val dayEnd = d.plusDays(1).atStartOfDay(zone).toInstant()
                    val sleepStart = d.minusDays(1).atTime(18, 0).atZone(zone).toInstant()
                    val sleepEnd = d.atTime(12, 0).atZone(zone).toInstant()

                    val obj = JSObject().put("date", d.toString())
                    val origins = JSObject()

                    val steps = client.aggregate(
                        AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(dayStart, dayEnd))
                    )
                    steps[StepsRecord.COUNT_TOTAL]?.let { obj.put("steps", it) }
                    origins.put("steps", JSArray(steps.dataOrigins.map { it.packageName }))

                    val sleep = client.aggregate(
                        AggregateRequest(setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL), TimeRangeFilter.between(sleepStart, sleepEnd))
                    )
                    sleep[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.let { obj.put("sleepMinutes", it.toMinutes()) }
                    origins.put("sleep", JSArray(sleep.dataOrigins.map { it.packageName }))

                    val hr = client.aggregate(
                        AggregateRequest(setOf(HeartRateRecord.BPM_AVG), TimeRangeFilter.between(dayStart, dayEnd))
                    )
                    hr[HeartRateRecord.BPM_AVG]?.let { obj.put("avgHeartRate", it) }
                    origins.put("heartRate", JSArray(hr.dataOrigins.map { it.packageName }))

                    val ex = client.aggregate(
                        AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL), TimeRangeFilter.between(dayStart, dayEnd))
                    )
                    ex[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.let { obj.put("exerciseMinutes", it.toMinutes()) }
                    origins.put("exercise", JSArray(ex.dataOrigins.map { it.packageName }))

                    obj.put("origins", origins)
                    out.put(obj)
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) {
                call.reject("could not read Health Connect")
            }
        }
    }

    // ------------------------------------------------------------ home-screen widget

    @PluginMethod
    fun updateWidget(call: PluginCall) {
        val e = context.getSharedPreferences(AuraWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
        e.putBoolean("enabled", true)
        e.putInt("score", call.getInt("score") ?: -1)
        for (k in listOf("mood", "color", "sleep", "steps", "screen", "updated")) {
            e.putString(k, call.getString(k) ?: "–")
        }
        e.putBoolean("demo", call.getBoolean("demo") ?: false)
        e.apply()
        AuraWidgetProvider.refreshAll(context)
        call.resolve()
    }

    @PluginMethod
    fun clearWidget(call: PluginCall) {
        context.getSharedPreferences(AuraWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        AuraWidgetProvider.refreshAll(context)
        call.resolve()
    }

    // --------------------------------------------------------- alarm and calendar

    @PluginMethod
    fun setAlarm(call: PluginCall) {
        val i = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, call.getInt("hour") ?: 7)
            .putExtra(AlarmClock.EXTRA_MINUTES, call.getInt("minute") ?: 0)
            .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label") ?: "AURA")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
        call.resolve()
    }

    @PluginMethod
    fun addCalendarEvent(call: PluginCall) {
        val begin = call.getLong("startMillis") ?: System.currentTimeMillis()
        val i = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, call.getString("title") ?: "AURA event")
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
        call.resolve()
    }
}
