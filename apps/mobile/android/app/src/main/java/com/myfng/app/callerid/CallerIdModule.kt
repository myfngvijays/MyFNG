package com.myfng.app.callerid

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class CallerIdModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MyFNGCallerId"

  @ReactMethod
  fun syncAuth(apiUrl: String, token: String) {
    if (token.isBlank()) {
      CallerIdStore.clearAuth(reactContext)
    } else {
      CallerIdStore.saveAuth(reactContext, apiUrl, token)
    }
  }

  @ReactMethod
  fun setPendingCall(map: ReadableMap) {
    val payload = CallerIdPayload(
      leadId = map.string("leadId"),
      name = map.string("name"),
      phone = map.string("phone"),
      leadNumber = map.string("leadNumber"),
      place = map.string("place"),
      direction = map.string("direction").ifBlank { "outbound" },
      sessionId = map.string("sessionId"),
    )
    CallerIdStore.savePending(reactContext, payload)
  }

  @ReactMethod
  fun clearPendingCall() {
    CallerIdStore.clearPending(reactContext)
    CallerIdOverlayService.stop(reactContext)
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean) {
    CallerIdStore.setEnabled(reactContext, enabled)
    if (!enabled) CallerIdOverlayService.stop(reactContext)
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val map = com.facebook.react.bridge.Arguments.createMap()
    map.putBoolean("enabled", CallerIdStore.isEnabled(reactContext))
    map.putBoolean("overlay", Settings.canDrawOverlays(reactContext))
    map.putBoolean("supported", true)
    promise.resolve(map)
  }

  @ReactMethod
  fun requestOverlayPermission() {
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${reactContext.packageName}"),
    )
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun preview() {
    CallerIdController.show(
      reactContext,
      CallerIdPayload(
        leadId = "preview",
        name = "Rajesh Sharma",
        phone = "9876543210",
        leadNumber = "L-1842",
        place = "Swift Dzire · Pune",
        direction = "inbound",
      ),
    )
  }

  private fun ReadableMap.string(key: String): String =
    if (hasKey(key) && !isNull(key)) getString(key).orEmpty() else ""
}
