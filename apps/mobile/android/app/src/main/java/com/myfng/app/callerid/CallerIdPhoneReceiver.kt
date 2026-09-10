package com.myfng.app.callerid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

class CallerIdPhoneReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
    val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
    val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
    when (state) {
      TelephonyManager.EXTRA_STATE_RINGING,
      TelephonyManager.EXTRA_STATE_OFFHOOK,
      -> CallerIdController.onPhoneRinging(context, number)
      TelephonyManager.EXTRA_STATE_IDLE -> CallerIdController.onPhoneIdle(context)
    }
  }
}
