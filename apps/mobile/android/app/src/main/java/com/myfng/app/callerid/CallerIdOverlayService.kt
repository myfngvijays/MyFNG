package com.myfng.app.callerid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.myfng.app.MainActivity
import com.myfng.app.R

class CallerIdOverlayService : Service() {
  private var windowManager: WindowManager? = null
  private var overlay: View? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    startForeground(NOTIF_ID, buildNotification("MyFNG customer calling", null))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    val payload = intent?.toPayload() ?: CallerIdStore.getPending(this)
    if (payload == null || !payload.isUsable()) {
      stopSelf()
      return START_NOT_STICKY
    }
    startForeground(NOTIF_ID, buildNotification(payload.title, payload.leadId))
    showOverlay(payload)
    return START_STICKY
  }

  override fun onDestroy() {
    removeOverlay()
    super.onDestroy()
  }

  private fun showOverlay(payload: CallerIdPayload) {
    if (overlay != null) removeOverlay()
    val card = buildCard(payload)
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.TRANSLUCENT,
    )
    params.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    params.y = dp(28)
    params.width = WindowManager.LayoutParams.MATCH_PARENT
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    windowManager?.addView(card, params)
    overlay = card
  }

  private fun buildCard(payload: CallerIdPayload): View {
    val pad = dp(16)
    val wrap = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(10), 0, dp(10), 0)
    }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, dp(12), pad, dp(6))
      background = rounded(Color.WHITE, 22f)
      elevation = dp(12).toFloat()
    }

    val top = row()
    top.addView(text("myfng", 15, Color.parseColor("#111827"), true), weight())
    top.addView(text(if (payload.direction == "inbound") "Incoming call" else "Calling now", 11, Color.parseColor("#9CA3AF"), false))
    val close = text("✕", 18, Color.parseColor("#6B7280"), false)
    close.setPadding(dp(8), 0, 0, 0)
    close.setOnClickListener { stopSelf() }
    top.addView(close)
    card.addView(top)

    val ident = row()
    ident.setPadding(0, dp(12), 0, 0)
    val avatar = TextView(this).apply {
      text = payload.title.trim().take(1).uppercase().ifBlank { "?" }
      setTextColor(Color.parseColor("#111827"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      background = circle(Color.parseColor("#E5E7EB"))
      width = dp(52)
      height = dp(52)
    }
    ident.addView(avatar)
    val mid = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), 0, 0, 0)
    }
    val nameRow = row()
    nameRow.addView(text(payload.title, 20, Color.parseColor("#111827"), true), weight())
    nameRow.addView(text("✓", 14, Color.parseColor("#0B57D0"), true))
    mid.addView(nameRow)
    val openBtn = text("  Open lead  ", 13, Color.parseColor("#0B57D0"), true).apply {
      background = roundedStroke(Color.parseColor("#0B57D0"), 999f)
      setPadding(dp(12), dp(6), dp(12), dp(6))
      setOnClickListener { openLead(payload.leadId) }
    }
    val openWrap = LinearLayout(this).apply {
      setPadding(0, dp(8), 0, 0)
      addView(openBtn)
    }
    mid.addView(openWrap)
    ident.addView(mid, weight())
    card.addView(ident)

    val phoneLine = payload.phone.ifBlank { payload.leadNumber }
    if (phoneLine.isNotBlank()) {
      card.addView(text(phoneLine, 15, Color.parseColor("#111827"), false).apply {
        setPadding(0, dp(14), 0, 0)
      })
    }
    val place = listOf(payload.leadNumber.takeIf { it.isNotBlank() && it != phoneLine }, payload.place.ifBlank { "MyFNG customer" })
      .filterNotNull()
      .joinToString(" · ")
    card.addView(text(place, 13, Color.parseColor("#6B7280"), false).apply {
      setPadding(0, dp(2), 0, 0)
    })

    val actions = row().apply {
      setPadding(0, dp(10), 0, 0)
    }
    actions.addView(action("OPEN") { openLead(payload.leadId) }, weight())
    actions.addView(action("HIDE") { stopSelf() }, weight())
    actions.addView(action("CLOSE") { stopSelf() }, weight())
    card.addView(actions)
    card.setOnClickListener { openLead(payload.leadId) }
    wrap.addView(card)
    return wrap
  }

  private fun action(label: String, onClick: () -> Unit): TextView =
    text(label, 11, Color.parseColor("#111827"), true).apply {
      gravity = Gravity.CENTER
      setPadding(0, dp(12), 0, dp(10))
      setOnClickListener { onClick() }
    }

  private fun openLead(leadId: String) {
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = if (leadId.isNotBlank()) Uri.parse("myfng://crm/lead/$leadId") else Uri.parse("myfng://crm")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra("lead_id", leadId)
    }
    startActivity(intent)
    stopSelf()
  }

  private fun removeOverlay() {
    overlay?.let {
      try {
        windowManager?.removeView(it)
      } catch (_: Exception) {
      }
    }
    overlay = null
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java) ?: return
    val ch = NotificationChannel(CHANNEL, "Caller ID", NotificationManager.IMPORTANCE_LOW)
    ch.description = "Shows MyFNG customer identity during a call"
    mgr.createNotificationChannel(ch)
  }

  private fun buildNotification(title: String, leadId: String?): Notification {
    val open = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = if (!leadId.isNullOrBlank()) Uri.parse("myfng://crm/lead/$leadId") else Uri.parse("myfng://crm")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pi = PendingIntent.getActivity(this, 7, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      Notification.Builder(this, CHANNEL)
    else
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    return b.setContentTitle(title)
      .setContentText("MyFNG customer — tap to open lead")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pi)
      .setOngoing(true)
      .build()
  }

  private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
  private fun weight() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
  private fun text(value: String, sp: Int, color: Int, bold: Boolean) = TextView(this).apply {
    text = value
    setTextColor(color)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp.toFloat())
    typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    maxLines = 1
  }
  private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
  private fun rounded(color: Int, radiusDp: Float) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, radiusDp, resources.displayMetrics)
  }
  private fun roundedStroke(color: Int, radiusDp: Float) = GradientDrawable().apply {
    setColor(Color.TRANSPARENT)
    setStroke(dp(1), color)
    cornerRadius = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, radiusDp, resources.displayMetrics)
  }
  private fun circle(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(color)
  }

  companion object {
    private const val CHANNEL = "caller_id"
    private const val NOTIF_ID = 7142
    const val ACTION_STOP = "com.myfng.app.callerid.STOP"

    fun start(ctx: Context, payload: CallerIdPayload) {
      val i = Intent(ctx, CallerIdOverlayService::class.java).putPayload(payload)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(i)
      } else {
        ctx.startService(i)
      }
    }

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, CallerIdOverlayService::class.java))
    }
  }
}

private fun Intent.putPayload(payload: CallerIdPayload): Intent = apply {
  putExtra("lead_id", payload.leadId)
  putExtra("name", payload.name)
  putExtra("phone", payload.phone)
  putExtra("lead_number", payload.leadNumber)
  putExtra("place", payload.place)
  putExtra("direction", payload.direction)
  putExtra("session_id", payload.sessionId)
}

private fun Intent.toPayload(): CallerIdPayload = CallerIdPayload(
  leadId = getStringExtra("lead_id").orEmpty(),
  name = getStringExtra("name").orEmpty(),
  phone = getStringExtra("phone").orEmpty(),
  leadNumber = getStringExtra("lead_number").orEmpty(),
  place = getStringExtra("place").orEmpty(),
  direction = getStringExtra("direction").orEmpty(),
  sessionId = getStringExtra("session_id").orEmpty(),
)
