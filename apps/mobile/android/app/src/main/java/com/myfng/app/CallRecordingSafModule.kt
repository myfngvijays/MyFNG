package com.myfng.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.bridge.NativeModule

private const val TAG = "MyFNGCallRecordingSaf"
private const val PICK_TREE_REQUEST = 5395
private val AUDIO_EXT = Regex("\\.(mp3|m4a|amr|wav|aac|3gp|ogg|mp4)$", RegexOption.IGNORE_CASE)

/**
 * Samsung / large call-recording folders: Expo's DocumentFile.canRead() often fails even after
 * the user taps Allow on the tree picker. We take persistable URI permission with full flags
 * and list children via DocumentsContract (handles 30k+ files in Recordings/Call).
 */
class CallRecordingSafModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx),
  ActivityEventListener {

  private var pickPromise: Promise? = null

  init {
    ctx.addActivityEventListener(this)
  }

  override fun getName(): String = "MyFNGCallRecordingSaf"

  @ReactMethod
  fun pickFolder(initialRelPath: String?, promise: Promise) {
    val activity = ctx.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "App screen active nahi hai — dobara try karein.")
      return
    }
    if (pickPromise != null) {
      promise.reject("PENDING", "Folder picker pehle se khula hai.")
      return
    }
    pickPromise = promise
    val intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addCategory(Intent.CATEGORY_DEFAULT)
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val rel = initialRelPath?.trim()?.trim('/')
          if (!rel.isNullOrEmpty()) {
            val initial =
              Uri.parse(
                "content://com.android.externalstorage.documents/tree/primary:${rel}",
              )
            putExtra(DocumentsContract.EXTRA_INITIAL_URI, initial)
          }
        }
      }
    try {
      @Suppress("DEPRECATION")
      activity.startActivityForResult(intent, PICK_TREE_REQUEST)
    } catch (e: Throwable) {
      pickPromise = null
      promise.reject("PICK_FAILED", e.message ?: "Folder picker open nahi ho paya")
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PICK_TREE_REQUEST) return
    val promise = pickPromise ?: return
    pickPromise = null
    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(null)
      return
    }
    val treeUri = normalizeTreeUri(data.data!!)
    val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    try {
      ctx.contentResolver.takePersistableUriPermission(treeUri, flags)
    } catch (e: Throwable) {
      Log.w(TAG, "takePersistableUriPermission failed", e)
    }
    val out: WritableMap = Arguments.createMap()
    out.putBoolean("granted", true)
    out.putString("directoryUri", treeUri.toString())
    promise.resolve(out)
  }

  @ReactMethod
  fun checkFolder(treeUriStr: String, promise: Promise) {
    val out: WritableMap = Arguments.createMap()
    val treeUri = parseTreeUri(treeUriStr)
    if (treeUri == null) {
      out.putBoolean("ok", false)
      out.putInt("audio", 0)
      out.putString("error", "Galat folder URI — dobara select karein.")
      promise.resolve(out)
      return
    }
    if (!isPhoneStorage(treeUri)) {
      out.putBoolean("ok", false)
      out.putInt("audio", 0)
      out.putString(
        "error",
        "Ye phone ka folder nahi hai. Phone memory → Recordings → Call chunein, Google Drive nahi.",
      )
      promise.resolve(out)
      return
    }
    try {
      var audio = 0
      queryChildren(treeUri) { name, mime ->
        if (mime == DocumentsContract.Document.MIME_TYPE_DIR) return@queryChildren
        if (isAudioFileName(name)) audio += 1
      }
      out.putBoolean("ok", true)
      out.putInt("audio", audio)
      promise.resolve(out)
    } catch (e: Throwable) {
      Log.w(TAG, "checkFolder failed", e)
      out.putBoolean("ok", false)
      out.putInt("audio", 0)
      val hint =
        if (!hasPersistedRead(treeUri)) {
          "Folder ki permission nahi mili. Change folder → Internal storage → Recordings → Call → Use this folder → Allow."
        } else {
          e.message ?: "Folder padh nahi paa rahe — same folder dobara select karein."
        }
      out.putString("error", hint)
      promise.resolve(out)
    }
  }

  /** List audio files with document URIs (name + uri). */
  @ReactMethod
  fun listAudioEntries(treeUriStr: String, promise: Promise) {
    val treeUri = parseTreeUri(treeUriStr)
    if (treeUri == null || !isPhoneStorage(treeUri)) {
      promise.reject("NO_ACCESS", "Folder access nahi hai — pehle folder select karein.")
      return
    }
    try {
      val rows: WritableArray = Arguments.createArray()
      val docId = DocumentsContract.getTreeDocumentId(treeUri)
      val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
      val projection =
        arrayOf(
          DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
      ctx.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
        val idIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
        val nameIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
        val mimeIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
        while (cursor.moveToNext()) {
          val mime = cursor.getString(mimeIdx) ?: ""
          if (mime == DocumentsContract.Document.MIME_TYPE_DIR) continue
          val name = cursor.getString(nameIdx) ?: ""
          if (!isAudioFileName(name)) continue
          val childId = cursor.getString(idIdx) ?: continue
          val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
          val row: WritableMap = Arguments.createMap()
          row.putString("uri", fileUri.toString())
          row.putString("name", name)
          rows.pushMap(row)
        }
      } ?: throw IllegalStateException("Folder query returned null")
      promise.resolve(rows)
    } catch (e: Throwable) {
      promise.reject("LIST_FAILED", e.message ?: "Folder list fail")
    }
  }

  private fun queryChildren(treeUri: Uri, each: (name: String, mime: String) -> Unit) {
    val docId = DocumentsContract.getTreeDocumentId(treeUri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
    val projection =
      arrayOf(
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
      )
    ctx.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
      val nameIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val mimeIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      while (cursor.moveToNext()) {
        val name = cursor.getString(nameIdx) ?: ""
        val mime = cursor.getString(mimeIdx) ?: ""
        each(name, mime)
      }
    } ?: throw IllegalStateException("Location '$treeUri' isn't readable.")
  }

  private fun parseTreeUri(uriStr: String): Uri? {
    val raw = normalizeTreeUri(Uri.parse(uriStr.trim()))
    return if (raw.scheme == "content") raw else null
  }

  private fun normalizeTreeUri(uri: Uri): Uri {
    val s = uri.toString()
    val docIdx = s.indexOf("/document/")
    return if (docIdx > 0) Uri.parse(s.substring(0, docIdx)) else uri
  }

  private fun isPhoneStorage(uri: Uri): Boolean =
    uri.authority == "com.android.externalstorage.documents"

  private fun hasPersistedRead(uri: Uri): Boolean {
    val normalized = normalizeTreeUri(uri)
    return ctx.contentResolver.persistedUriPermissions.any {
      normalizeTreeUri(it.uri) == normalized && it.isReadPermission
    }
  }

  private fun isAudioFileName(name: String): Boolean = AUDIO_EXT.containsMatchIn(name)

  override fun onNewIntent(intent: Intent?) {}
}

class CallRecordingSafPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(CallRecordingSafModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}