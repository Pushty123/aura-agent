package `in`.phoenix.aura

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.widget.RemoteViews

/**
 * AURA home-screen widget: Balance Score ring plus sleep, steps and screen time.
 * The app pushes ready-to-show strings through AuraNativePlugin.updateWidget;
 * nothing is computed or decrypted here.
 */
class AuraWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
    }

    companion object {
        const val PREFS = "aura_widget"

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AuraWidgetProvider::class.java))
            for (id in ids) render(context, manager, id)
        }

        private fun parseColor(hex: String?, fallback: Int): Int =
            try { if (hex.isNullOrBlank()) fallback else Color.parseColor(hex) } catch (e: Exception) { fallback }

        private fun ring(score: Int, color: Int): Bitmap {
            val size = 240
            val stroke = 26f
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val box = RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = stroke
                strokeCap = Paint.Cap.ROUND
            }
            paint.color = Color.parseColor("#2E2C66")
            canvas.drawArc(box, 0f, 360f, false, paint)
            if (score > 0) {
                paint.color = color
                canvas.drawArc(box, -90f, 360f * score.coerceAtMost(100) / 100f, false, paint)
            }
            return bmp
        }

        fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val views = RemoteViews(context.packageName, R.layout.aura_widget)
            val enabled = p.getBoolean("enabled", false)
            val score = if (enabled) p.getInt("score", -1) else -1
            val color = parseColor(p.getString("color", null), Color.parseColor("#A78BFA"))

            views.setImageViewBitmap(R.id.aura_ring, ring(score, color))
            views.setTextViewText(R.id.aura_score, if (score >= 0) score.toString() else "–")
            views.setTextViewText(
                R.id.aura_mood,
                if (enabled) p.getString("mood", "AURA") else "Turn on in AURA → Profile"
            )
            views.setTextViewText(R.id.aura_sleep, if (enabled) p.getString("sleep", "–") else "–")
            views.setTextViewText(R.id.aura_steps, if (enabled) p.getString("steps", "–") else "–")
            views.setTextViewText(R.id.aura_screen, if (enabled) p.getString("screen", "–") else "–")
            views.setTextViewText(R.id.aura_updated, if (enabled) "AURA · " + p.getString("updated", "") else "AURA")
            views.setViewVisibility(
                R.id.aura_demo,
                if (enabled && p.getBoolean("demo", false)) View.VISIBLE else View.GONE
            )

            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launch != null) {
                val pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.aura_root, pi)
            }
            manager.updateAppWidget(id, views)
        }
    }
}
