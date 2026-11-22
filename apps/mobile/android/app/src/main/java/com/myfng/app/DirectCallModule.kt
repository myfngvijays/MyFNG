package com.myfng.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * Telecaller calls on Android:
 * - call(): places the call straight away (ACTION_CALL, needs CALL_PHONE).
 * - watchCallEnd(): when the call hangs up, brings MyFNG back to the front
 *   (needs READ_PHONE_STATE to see the hang-up, and "Display over other apps"
 *   so Android lets a background app come forward).
 */
class DirectCallModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "MyFNGDirectCall"

  @ReactMethod
  fun call(number: String, promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CALL_PHONE) ==
      PackageManager.PERMISSION_GRANTED
    if (!granted || number.isBlank()) {
      promise.resolve(false)
      return
    }
    try {
      CallEndWatcher.start(ctx.applicationContext)
      val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number)))
      val activity = ctx.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Throwable) {
      CallEndWatcher.stop()
      android.util.Log.w("MyFNG", "Direct call failed", e)
      promise.resolve(false)
    }
  }

  /** Bring the app back after the next call ends (used before a plain tel: dialer). */
  @ReactMethod
  fun watchCallEnd() {
    CallEndWatcher.start(ctx.applicationContext)
  }

  @ReactMethod
  fun canReturnAfterCall(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx))
  }

  @ReactMethod
  fun openReturnAfterCallSettings() {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:" + ctx.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
    } catch (e: Throwable) {
      android.util.Log.w("MyFNG", "Overlay settings failed", e)
    }
  }
}

object CallEndWatcher {
  private const val MAX_WATCH_MS = 3L * 60 * 60 * 1000
  private val main = Handler(Looper.getMainLooper())
  private var telephony: TelephonyManager? = null
  private var listener: Any? = null
  private var sawOffhook = false
  private val timeout = Runnable { stop() }

  fun start(app: Context) {
    main.post { startOnMain(app) }
  }

  private fun startOnMain(app: Context) {
    stopOnMain()
    val granted = ContextCompat.checkSelfPermission(app, Manifest.permission.READ_PHONE_STATE) ==
      PackageManager.PERMISSION_GRANTED
    if (!granted) return
    val tm = app.getSystemService(TelephonyManager::class.java) ?: return
    sawOffhook = false
    val onState: (Int) -> Unit = { state ->
      when (state) {
        TelephonyManager.CALL_STATE_OFFHOOK -> sawOffhook = true
        TelephonyManager.CALL_STATE_IDLE -> if (sawOffhook) {
          stopOnMain()
          // Let the phone app close its in-call screen first.
          main.postDelayed({ bringToFront(app) }, 700)
        }
      }
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
          override fun onCallStateChanged(state: Int) = onState(state)
        }
        tm.registerTelephonyCallback(app.mainExecutor, cb)
        listener = cb
      } else {
        @Suppress("DEPRECATION")
        val l = object : PhoneStateListener() {
          @Deprecated("Deprecated in Java")
          override fun onCallStateChanged(state: Int, phoneNumber: String?) = onState(state)
        }
        @Suppress("DEPRECATION")
        tm.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
        listener = l
      }
      telephony = tm
      main.postDelayed(timeout, MAX_WATCH_MS)
    } catch (e: Throwable) {
      android.util.Log.w("MyFNG", "Call watch failed", e)
    }
  }

  fun stop() {
    main.post { stopOnMain() }
  }

  private fun stopOnMain() {
    main.removeCallbacks(timeout)
    val tm = telephony
    val l = listener
    telephony = null
    listener = null
    if (tm == null || l == null) return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && l is TelephonyCallback) {
        tm.unregisterTelephonyCallback(l)
      } else if (l is PhoneStateListener) {
        @Suppress("DEPRECATION")
        tm.listen(l, PhoneStateListener.LISTEN_NONE)
      }
    } catch (_: Throwable) {
    }
  }

  private fun bringToFront(app: Context) {
    try {
      val intent = app.packageManager.getLaunchIntentForPackage(app.packageName) ?: return
      intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP,
      )
      app.startActivity(intent)
    } catch (e: Throwable) {
      android.util.Log.w("MyFNG", "Return after call failed", e)
    }
  }
}

class DirectCallPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(DirectCallModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
