package com.myfng.app.callerid

import android.content.Context

data class CallerIdPayload(
  val leadId: String = "",
  val name: String = "",
  val phone: String = "",
  val leadNumber: String = "",
  val place: String = "",
  val direction: String = "",
  val sessionId: String = "",
) {
  val title: String
    get() = name.ifBlank { leadNumber.ifBlank { if (phone.isNotBlank()) phone else "MyFNG customer" } }

  val hasLead: Boolean
    get() = leadId.isNotBlank()

  fun isUsable(): Boolean = hasLead || name.isNotBlank() || phone.isNotBlank()
}

object CallerIdStore {
  private const val PREF = "myfng_caller_id"
  @Volatile var appForeground: Boolean = false

  fun isEnabled(ctx: Context): Boolean =
    prefs(ctx).getBoolean("enabled", true)

  fun setEnabled(ctx: Context, enabled: Boolean) {
    prefs(ctx).edit().putBoolean("enabled", enabled).apply()
  }

  fun saveAuth(ctx: Context, apiUrl: String, token: String) {
    prefs(ctx).edit()
      .putString("api_url", apiUrl.trim().trimEnd('/'))
      .putString("token", token)
      .apply()
  }

  fun clearAuth(ctx: Context) {
    prefs(ctx).edit().remove("api_url").remove("token").apply()
  }

  fun apiUrl(ctx: Context): String = prefs(ctx).getString("api_url", "") ?: ""

  fun token(ctx: Context): String = prefs(ctx).getString("token", "") ?: ""

  fun savePending(ctx: Context, payload: CallerIdPayload) {
    prefs(ctx).edit()
      .putString("lead_id", payload.leadId)
      .putString("name", payload.name)
      .putString("phone", payload.phone)
      .putString("lead_number", payload.leadNumber)
      .putString("place", payload.place)
      .putString("direction", payload.direction)
      .putString("session_id", payload.sessionId)
      .putLong("pending_at", System.currentTimeMillis())
      .apply()
  }

  fun getPending(ctx: Context, maxAgeMs: Long = 8 * 60_000L): CallerIdPayload? {
    val p = prefs(ctx)
    val at = p.getLong("pending_at", 0L)
    if (at <= 0L || System.currentTimeMillis() - at > maxAgeMs) return null
    val payload = CallerIdPayload(
      leadId = p.getString("lead_id", "") ?: "",
      name = p.getString("name", "") ?: "",
      phone = p.getString("phone", "") ?: "",
      leadNumber = p.getString("lead_number", "") ?: "",
      place = p.getString("place", "") ?: "",
      direction = p.getString("direction", "") ?: "",
      sessionId = p.getString("session_id", "") ?: "",
    )
    return if (payload.isUsable()) payload else null
  }

  fun clearPending(ctx: Context) {
    prefs(ctx).edit()
      .remove("lead_id")
      .remove("name")
      .remove("phone")
      .remove("lead_number")
      .remove("place")
      .remove("direction")
      .remove("session_id")
      .remove("pending_at")
      .apply()
  }

  private fun prefs(ctx: Context) =
    ctx.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
}
