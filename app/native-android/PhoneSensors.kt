package `in`.phoenix.aura

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Data the phone can measure by itself, with no band or fitness app:
 *  - steps, from the built-in step counter sensor (sampled every 15 minutes)
 *  - an estimate of sleep, from the longest screen-off stretch overnight
 * Everything stays in this app's private storage until the app reads it.
 */
object StepStore {
    private const val PREFS = "aura_steps"

    /** Reads the step counter once (it counts since the phone was last restarted). */
    fun readCounter(ctx: Context, timeoutMs: Long = 4000): Float? {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
        var value: Float? = null
        val latch = CountDownLatch(1)
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) { value = e.values[0]; latch.countDown() }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        latch.await(timeoutMs, TimeUnit.MILLISECONDS)
        sm.unregisterListener(l)
        return value
    }

    fun hasSensor(ctx: Context): Boolean =
        (ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager).getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

    /**
     * Stores one sample. Per day we keep {base, last, acc}: steps = acc + (last - base).
     * A restart resets the counter to 0, so what was counted so far moves into acc.
     */
    @Synchronized
    fun record(ctx: Context, counter: Float) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val all = try { JSONObject(prefs.getString("days", "{}")) } catch (e: Exception) { JSONObject() }
        val today = LocalDate.now().toString()
        val c = counter.toDouble()
        val day = all.optJSONObject(today) ?: run {
            // Start today from yesterday's last sample so steps since then are not lost.
            val y = all.optJSONObject(LocalDate.now().minusDays(1).toString())
            val base = if (y != null && c >= y.optDouble("last", c)) y.optDouble("last", c) else c
            JSONObject().put("base", base).put("last", base).put("acc", 0.0)
        }
        val last = day.optDouble("last", c)
        if (c < last) { // phone restarted
            day.put("acc", day.optDouble("acc", 0.0) + (last - day.optDouble("base", 0.0)))
            day.put("base", 0.0)
        }
        day.put("last", c)
        all.put(today, day)
        // Keep 60 days.
        val cut = LocalDate.now().minusDays(60).toString()
        all.keys().asSequence().toList().filter { it < cut }.forEach { all.remove(it) }
        prefs.edit().putString("days", all.toString()).apply()
    }

    fun steps(ctx: Context, date: String): Int? {
        val all = try { JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("days", "{}")) } catch (e: Exception) { return null }
        val d = all.optJSONObject(date) ?: return null
        return (d.optDouble("acc", 0.0) + d.optDouble("last", 0.0) - d.optDouble("base", 0.0)).toInt().coerceAtLeast(0)
    }

    fun sample(ctx: Context) {
        readCounter(ctx)?.let { record(ctx, it) }
    }
}

object SleepEstimate {
    data class Night(val start: Long, val end: Long, val minutes: Long)

    /**
     * The longest screen-off stretch between 19:00 the evening before and 13:00 on `date`.
     * Short phone checks (under 10 minutes on) are bridged, and their time is subtracted.
     * Needs usage access. Returns null if no stretch of at least 3 hours is found.
     */
    fun forDate(ctx: Context, date: LocalDate, zone: ZoneId): Night? {
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val from = date.minusDays(1).atTime(19, 0).atZone(zone).toInstant().toEpochMilli()
        val to = minOf(date.atTime(13, 0).atZone(zone).toInstant().toEpochMilli(), System.currentTimeMillis())
        if (to <= from) return null
        val ev = UsageEvents.Event()
        val events = usm.queryEvents(from, to)
        // Screen-on intervals.
        val on = mutableListOf<LongArray>()
        var onAt: Long? = null
        var first = true
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            when (ev.eventType) {
                UsageEvents.Event.SCREEN_INTERACTIVE -> { onAt = ev.timeStamp; first = false }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                    on.add(longArrayOf(onAt ?: if (first) from else ev.timeStamp, ev.timeStamp))
                    onAt = null; first = false
                }
            }
        }
        if (onAt != null) on.add(longArrayOf(onAt!!, to))
        if (on.isEmpty()) return null
        // Off gaps between on-intervals.
        val gaps = mutableListOf<LongArray>()
        var prevEnd = from
        for (iv in on) { if (iv[0] > prevEnd) gaps.add(longArrayOf(prevEnd, iv[0])); prevEnd = maxOf(prevEnd, iv[1]) }
        if (to > prevEnd) gaps.add(longArrayOf(prevEnd, to))
        // Bridge gaps separated by short checks.
        val bridge = 10 * 60_000L
        var best: Night? = null
        var i = 0
        while (i < gaps.size) {
            var s = gaps[i][0]; var e = gaps[i][1]; var off = e - s
            var j = i + 1
            while (j < gaps.size && gaps[j][0] - e <= bridge) { off += gaps[j][1] - gaps[j][0]; e = gaps[j][1]; j++ }
            // Ignore a stretch that is only the open edge of the window in the evening.
            val mins = off / 60_000
            if (mins >= 180 && (best == null || mins > best.minutes)) best = Night(s, e, mins)
            i = j
        }
        return best
    }
}

/** Samples the step counter every 15 minutes, even when AURA is closed. */
class StepWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        try { StepStore.sample(applicationContext) } catch (e: Exception) { /* sensor busy or not allowed */ }
        return Result.success()
    }

    companion object {
        private const val WORK = "aura-steps"
        fun schedule(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                WORK, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<StepWorker>(15, TimeUnit.MINUTES).build()
            )
        }
    }
}
