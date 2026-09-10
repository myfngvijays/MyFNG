package com.myfng.app.callerid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Reads FCM data before RN Firebase so caller-ID overlay works with the app killed. */
class CallerIdPushReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val extras = intent.extras ?: return
    val data = HashMap<String, String?>()
    for (key in extras.keySet()) {
      val value = extras.get(key)
      if (value != null) data[key] = value.toString()
    }
    if ((data["kind"] ?: "") != "CALLER_ID") return
    CallerIdController.onPush(context, data)
  }
}
