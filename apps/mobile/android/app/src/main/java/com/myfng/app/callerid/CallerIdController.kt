package com.myfng.app.callerid

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object CallerIdController {
  private const val TAG = "MyFNGCallerId"
  private val io = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())

  fun onPush(ctx: Context, data: Map<String, String?>) {
    val kind = data["kind"] ?: return
    if (kind != "CALLER_ID") return
    val payload = CallerIdPayload(
      leadId = data["lead_id"].orEmpty(),
      name = data["customer_name"].orEmpty(),
      phone = data["customer_phone"].orEmpty(),
      leadNumber = data["lead_number"].orEmpty(),
      place = data["place"].orEmpty(),
      direction = data["direction"].orEmpty(),
      sessionId = data["session_id"].orEmpty(),
    )
    if (!payload.isUsable()) return
    CallerIdStore.savePending(ctx, payload)
    show(ctx, payload)
  }

  fun onPhoneRinging(ctx: Context, incomingNumber: String?) {
    if (!CallerIdStore.isEnabled(ctx)) return
    val pending = CallerIdStore.getPending(ctx)
    if (pending != null) {
      show(ctx, pending)
      if (pending.name.isBlank() && !incomingNumber.isNullOrBlank()) {
        lookupAndShow(ctx, incomingNumber, pending)
      }
      return
    }
    if (!incomingNumber.isNullOrBlank()) {
      lookupAndShow(ctx, incomingNumber, null)
    }
  }

  fun onPhoneIdle(ctx: Context) {
    main.postDelayed({ CallerIdOverlayService.stop(ctx) }, 1500)
  }

  fun show(ctx: Context, payload: CallerIdPayload) {
    if (!CallerIdStore.isEnabled(ctx)) return
    if (!payload.isUsable()) return
    if (!Settings.canDrawOverlays(ctx)) {
      Log.w(TAG, "overlay permission missing")
      return
    }
    CallerIdOverlayService.start(ctx, payload)
  }

  private fun lookupAndShow(ctx: Context, phone: String, fallback: CallerIdPayload?) {
    val api = CallerIdStore.apiUrl(ctx)
    val token = CallerIdStore.token(ctx)
    if (api.isBlank() || token.isBlank()) {
      if (fallback != null) show(ctx, fallback)
      return
    }
    io.execute {
      try {
        val digits = phone.filter { it.isDigit() }.takeLast(10)
        val url = URL("$api/api/telecaller/crm/caller-id?phone=$digits")
        val conn = (url.openConnection() as HttpURLConnection).apply {
          connectTimeout = 6000
          readTimeout = 6000
          setRequestProperty("Authorization", "Bearer $token")
          setRequestProperty("x-mobile-client", "true")
        }
        val body = conn.inputStream.bufferedReader().use { it.readText() }
        conn.disconnect()
        val json = JSONObject(body)
        val lead = json.optJSONObject("lead") ?: return@execute
        val payload = CallerIdPayload(
          leadId = lead.optString("id"),
          name = lead.optString("customer_name"),
          phone = lead.optString("customer_phone").ifBlank { digits },
          leadNumber = lead.optString("lead_number"),
          place = listOf(
            lead.optString("vehicle_make"),
            lead.optString("vehicle_model"),
            lead.optString("vehicle_number"),
            lead.optString("city"),
          ).filter { it.isNotBlank() }.joinToString(" · "),
          direction = "inbound",
        )
        if (payload.isUsable()) {
          CallerIdStore.savePending(ctx, payload)
          main.post { show(ctx, payload) }
        }
      } catch (e: Exception) {
        Log.w(TAG, "lookup failed: ${e.message}")
        if (fallback != null) main.post { show(ctx, fallback) }
      }
    }
  }
}
