package `in`.phoenix.aura

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/** Per-app usage for today, computed from Android's usage events (on the phone only). */
object UsageCalc {
    data class Today(val minutes: Map<String, Long>, val opens: Map<String, Int>, val unlocks: Int)

    private fun launchers(ctx: Context): Set<String> {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return ctx.packageManager.queryIntentActivities(home, 0).map { it.activityInfo.packageName }.toSet()
    }

    fun today(ctx: Context): Today {
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant().toEpochMilli()
        val end = System.currentTimeMillis()
        val events = usm.queryEvents(start, end)
        val ev = UsageEvents.Event()
        val resumed = HashMap<String, Long>()
        val total = HashMap<String, Long>()
        val opens = HashMap<String, Int>()
        var unlocks = 0
        var last: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val p = ev.packageName ?: continue
            when (ev.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> {
                    resumed[p] = ev.timeStamp
                    if (last != p) opens[p] = (opens[p] ?: 0) + 1
                    last = p
                }
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
                    val t = resumed.remove(p)
                    if (t != null && ev.timeStamp > t) total[p] = (total[p] ?: 0) + (ev.timeStamp - t)
                }
                18 /* KEYGUARD_HIDDEN, API 28+ */ -> if (Build.VERSION.SDK_INT >= 28) { unlocks++; last = null }
            }
        }
        for ((p, t) in resumed) if (end > t) total[p] = (total[p] ?: 0) + (end - t)
        val skip = launchers(ctx) + setOf(ctx.packageName, "com.android.systemui", "android")
        val minutes = total.filterKeys { it !in skip }.mapValues { it.value / 60000 }.filterValues { it > 0 }
        return Today(minutes, opens.filterKeys { it in minutes }, unlocks)
    }

    fun label(ctx: Context, pkg: String): String = try {
        val pm = ctx.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) { pkg }
}

/** Runs about every 15 minutes and posts a notification when an app passes 80% or 100% of its daily limit. */
class AppLimitWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val limits = try { JSONArray(prefs.getString("limits", "[]")) } catch (e: Exception) { JSONArray() }
        if (limits.length() == 0) return Result.success()
        val today = try { UsageCalc.today(ctx) } catch (e: Exception) { return Result.success() }
        val date = LocalDate.now().toString()
        val sent = prefs.getStringSet("sent", emptySet())!!.filter { it.startsWith(date) }.toMutableSet()
        for (i in 0 until limits.length()) {
            val o = limits.getJSONObject(i)
            val pkg = o.optString("pkg"); val label = o.optString("label", pkg); val limit = o.optInt("minutes", 0)
            if (limit <= 0) continue
            val used = today.minutes[pkg] ?: 0L
            val level = when { used >= limit -> "100"; used >= limit * 0.8 -> "80"; else -> null } ?: continue
            val key = "$date|$pkg|$level"
            if (key in sent) continue
            sent.add(key)
            notify(
                ctx, pkg.hashCode() + level.hashCode(),
                if (level == "100") "Time limit reached: $label" else "Almost at your $label limit",
                if (level == "100") "You've used $label for $used min today (your limit is $limit min)."
                else "$used of $limit min used today."
            )
        }
        prefs.edit().putStringSet("sent", sent).apply()
        return Result.success()
    }

    companion object {
        const val PREFS = "aura_limits"
        private const val CHANNEL = "aura_app_limits"
        private const val WORK = "aura-app-limits"

        fun schedule(ctx: Context, hasLimits: Boolean) {
            val wm = WorkManager.getInstance(ctx)
            if (!hasLimits) { wm.cancelUniqueWork(WORK); return }
            wm.enqueueUniquePeriodicWork(
                WORK, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<AppLimitWorker>(15, TimeUnit.MINUTES).build()
            )
        }

        private fun notify(ctx: Context, id: Int, title: String, body: String) {
            val nm = NotificationManagerCompat.from(ctx)
            if (!nm.areNotificationsEnabled()) return
            if (Build.VERSION.SDK_INT >= 26) {
                (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
                    NotificationChannel(CHANNEL, "App time limits", NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
            val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            val pi = open?.let { PendingIntent.getActivity(ctx, 1, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
            val n = NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(ctx.applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .apply { if (pi != null) setContentIntent(pi) }
                .build()
            try { nm.notify(id, n) } catch (e: SecurityException) { /* notifications not allowed */ }
        }
    }
}
