package `in`.phoenix.aura

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * AURA reminders, handled like other Android apps:
 *  - daily alarms post a notification with "Done" and "Snooze 10 min" buttons;
 *  - tapping a button is handled here in the background, without opening the app;
 *  - "Done" taps are kept in a small queue (just the action name, no health data)
 *    because the person's data is encrypted and locked; the app applies them
 *    the next time it is unlocked.
 *  - alarms are set again after a restart or an app update.
 */
object Reminders {
    const val CHANNEL = "aura_reminders"
    private const val PREFS = "aura_reminders"
    const val ACTION_FIRE = "in.phoenix.aura.REMINDER_FIRE"
    const val ACTION_DONE = "in.phoenix.aura.REMINDER_DONE"
    const val ACTION_SNOOZE = "in.phoenix.aura.REMINDER_SNOOZE"

    data class Item(val id: Int, val title: String, val body: String, val hour: Int, val minute: Int, val rid: String, val action: String)

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun parse(arr: JSONArray): List<Item> = (0 until arr.length()).mapNotNull { i ->
        val o = arr.optJSONObject(i) ?: return@mapNotNull null
        Item(
            o.optInt("id"), o.optString("title", "AURA"), o.optString("body", ""),
            o.optInt("hour").coerceIn(0, 23), o.optInt("minute").coerceIn(0, 59),
            o.optString("rid", ""), o.optString("action", "done")
        )
    }

    private fun toJson(items: List<Item>): JSONArray {
        val a = JSONArray()
        items.forEach {
            a.put(JSONObject().put("id", it.id).put("title", it.title).put("body", it.body).put("hour", it.hour)
                .put("minute", it.minute).put("rid", it.rid).put("action", it.action))
        }
        return a
    }

    /** Replaces all daily reminders with this list and schedules them. Returns true if exact alarms are allowed. */
    fun replaceAll(ctx: Context, items: List<Item>): Boolean {
        val old = try { parse(JSONArray(prefs(ctx).getString("items", "[]"))) } catch (e: Exception) { emptyList() }
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        old.forEach { am.cancel(firePending(ctx, it, once = false)) }
        prefs(ctx).edit().putString("items", toJson(items).toString()).apply()
        items.forEach { schedule(ctx, it, nextTime(it.hour, it.minute), once = false) }
        return exactAllowed(ctx)
    }

    /** After a restart or app update. */
    fun rescheduleSaved(ctx: Context) {
        val items = try { parse(JSONArray(prefs(ctx).getString("items", "[]"))) } catch (e: Exception) { emptyList() }
        items.forEach { schedule(ctx, it, nextTime(it.hour, it.minute), once = false) }
    }

    fun nextTime(hour: Int, minute: Int): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, hour); c.set(Calendar.MINUTE, minute); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
        if (c.timeInMillis <= System.currentTimeMillis() + 1000) c.add(Calendar.DAY_OF_YEAR, 1)
        return c.timeInMillis
    }

    private fun exactAllowed(ctx: Context): Boolean {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
    }

    private fun intentFor(ctx: Context, action: String, it: Item, once: Boolean): Intent =
        Intent(ctx, ReminderReceiver::class.java).setAction(action)
            .putExtra("id", it.id).putExtra("title", it.title).putExtra("body", it.body)
            .putExtra("hour", it.hour).putExtra("minute", it.minute)
            .putExtra("rid", it.rid).putExtra("action", it.action).putExtra("once", once)

    private const val FLAGS = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    private fun firePending(ctx: Context, it: Item, once: Boolean): PendingIntent =
        PendingIntent.getBroadcast(ctx, if (once) it.id * 31 + 3 else it.id, intentFor(ctx, ACTION_FIRE, it, once), FLAGS)

    fun schedule(ctx: Context, it: Item, at: Long, once: Boolean) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = firePending(ctx, it, once)
        try {
            if (exactAllowed(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    fun show(ctx: Context, it: Item) {
        val nm = NotificationManagerCompat.from(ctx)
        if (!nm.areNotificationsEnabled()) return
        if (Build.VERSION.SDK_INT >= 26) {
            (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
                NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Water, goals and other reminders you set in AURA"
                }
            )
        }
        val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
        val openPi = open?.let { o -> PendingIntent.getActivity(ctx, it.id * 31 + 4, o, FLAGS) }
        val done = PendingIntent.getBroadcast(ctx, it.id * 31 + 1, intentFor(ctx, ACTION_DONE, it, true), FLAGS)
        val snooze = PendingIntent.getBroadcast(ctx, it.id * 31 + 2, intentFor(ctx, ACTION_SNOOZE, it, true), FLAGS)
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(ctx.applicationInfo.icon)
            .setContentTitle(it.title)
            .setContentText(it.body.ifBlank { it.title })
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "Done", done)
            .addAction(0, "Snooze 10 min", snooze)
            .apply { if (openPi != null) setContentIntent(openPi) }
            .build()
        try { nm.notify(it.id, n) } catch (e: SecurityException) { /* notifications not allowed */ }
    }

    @Synchronized
    fun queueDone(ctx: Context, it: Item) {
        val q = try { JSONArray(prefs(ctx).getString("queue", "[]")) } catch (e: Exception) { JSONArray() }
        q.put(JSONObject().put("action", it.action).put("rid", it.rid).put("ts", System.currentTimeMillis()))
        val keep = JSONArray()
        val from = maxOf(0, q.length() - 50)
        for (i in from until q.length()) keep.put(q.get(i))
        prefs(ctx).edit().putString("queue", keep.toString()).apply()
    }

    @Synchronized
    fun takeQueue(ctx: Context): JSONArray {
        val q = try { JSONArray(prefs(ctx).getString("queue", "[]")) } catch (e: Exception) { JSONArray() }
        prefs(ctx).edit().putString("queue", "[]").apply()
        return q
    }

    fun itemFrom(i: Intent) = Item(
        i.getIntExtra("id", 0), i.getStringExtra("title") ?: "AURA", i.getStringExtra("body") ?: "",
        i.getIntExtra("hour", 9), i.getIntExtra("minute", 0), i.getStringExtra("rid") ?: "", i.getStringExtra("action") ?: "done"
    )
}

/** Alarm fired, or a notification button was tapped. Runs in the background; never opens the app. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val item = Reminders.itemFrom(intent)
        when (intent.action) {
            Reminders.ACTION_FIRE -> {
                Reminders.show(ctx, item)
                // Daily reminders set their next alarm; snoozes and tests fire once.
                if (!intent.getBooleanExtra("once", false)) Reminders.schedule(ctx, item, Reminders.nextTime(item.hour, item.minute), once = false)
            }
            Reminders.ACTION_DONE -> {
                Reminders.queueDone(ctx, item)
                NotificationManagerCompat.from(ctx).cancel(item.id)
                val what = if (item.action == "water") "+1 glass of water saved" else "Marked as done"
                Toast.makeText(ctx, "$what. AURA will update when you open it.", Toast.LENGTH_SHORT).show()
            }
            Reminders.ACTION_SNOOZE -> {
                NotificationManagerCompat.from(ctx).cancel(item.id)
                Reminders.schedule(ctx, item, System.currentTimeMillis() + 10 * 60_000L, once = true)
                Toast.makeText(ctx, "Reminding you again in 10 minutes", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

/** Sets reminders again after the phone restarts or AURA is updated. */
class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Reminders.rescheduleSaved(ctx)
        }
    }
}
