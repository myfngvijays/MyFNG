package com.myfng.app

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.util.Log
import java.io.File
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
private const val LOCAL_STORAGE_AUTHORITY = "com.android.externalstorage.documents"
private val AUDIO_EXT = Regex("\\.(mp3|m4a|amr|wav|aac|3gp|ogg|mp4)$", RegexOption.IGNORE_CASE)
private const val MAX_SCAN_DEPTH = 4

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
            val docId = "primary:$rel"
            val initial =
              try {
                DocumentsContract.buildTreeDocumentUri(
                  LOCAL_STORAGE_AUTHORITY,
                  docId,
                )
              } catch (_: Throwable) {
                Uri.parse("content://$LOCAL_STORAGE_AUTHORITY/tree/$docId")
              }
            putExtra(DocumentsContract.EXTRA_INITIAL_URI, initial)
          }
        }
      }
    try {
      launchPhoneStorageTreePicker(activity, intent)
    } catch (e: Throwable) {
      pickPromise = null
      promise.reject("PICK_FAILED", e.message ?: "Folder picker open nahi ho paya")
    }
  }

  /**
   * Open Android Documents UI (My Files / phone storage), not Google Drive.
   */
  private fun launchPhoneStorageTreePicker(activity: Activity, intent: Intent) {
    val pkgCandidates =
      listOf(
        "com.google.android.documentsui",
        "com.android.documentsui",
        "com.sec.android.app.myfiles",
        "com.mi.android.globalFileexplorer",
        "com.coloros.filemanager",
      )
    for (pkg in pkgCandidates) {
      val targeted = Intent(intent).setPackage(pkg)
      if (targeted.resolveActivity(activity.packageManager, PackageManager.MATCH_DEFAULT_ONLY) != null) {
        try {
          @Suppress("DEPRECATION")
          activity.startActivityForResult(targeted, PICK_TREE_REQUEST)
          return
        } catch (e: Throwable) {
          Log.w(TAG, "picker package $pkg failed", e)
        }
      }
    }
    val chooser =
      Intent.createChooser(
        intent,
        "Phone storage (My Files) chunein — Google Drive mat chunein",
      )
    @Suppress("DEPRECATION")
    activity.startActivityForResult(chooser, PICK_TREE_REQUEST)
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
      val audio = countAudioRecursive(treeUri)
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

  @ReactMethod
  fun normalizeFsPath(input: String, promise: Promise) {
    try {
      val path = resolveFsPath(input)
      promise.resolve(path)
    } catch (e: Throwable) {
      promise.reject("BAD_PATH", e.message ?: "Galat path")
    }
  }

  @ReactMethod
  fun checkFsPath(pathStr: String, promise: Promise) {
    val out: WritableMap = Arguments.createMap()
    try {
      val dir = resolveFsPath(pathStr)?.let { File(it) }
      if (dir == null || !dir.exists() || !dir.isDirectory) {
        out.putBoolean("ok", false)
        out.putInt("audio", 0)
        out.putString("error", "Ye folder maujood nahi hai ya padh nahi sakte.")
        promise.resolve(out)
        return
      }
      if (!dir.canRead()) {
        out.putBoolean("ok", false)
        out.putInt("audio", 0)
        out.putString(
          "error",
          "Permission chahiye — Settings mein MyFNG ko Files / Audio allow karein.",
        )
        promise.resolve(out)
        return
      }
      out.putBoolean("ok", true)
      out.putInt("audio", countAudioInDir(dir, 0))
      promise.resolve(out)
    } catch (e: Throwable) {
      out.putBoolean("ok", false)
      out.putInt("audio", 0)
      out.putString("error", e.message ?: "Folder check fail")
      promise.resolve(out)
    }
  }

  @ReactMethod
  fun listAudioFromFsPath(pathStr: String, promise: Promise) {
    try {
      val dir = resolveFsPath(pathStr)?.let { File(it) }
        ?: throw IllegalStateException("Galat path")
      if (!dir.isDirectory || !dir.canRead()) {
        promise.reject("NO_ACCESS", "Folder padh nahi sakte")
        return
      }
      val rows: WritableArray = Arguments.createArray()
      collectFsAudio(dir, 0, rows)
      promise.resolve(rows)
    } catch (e: Throwable) {
      promise.reject("LIST_FAILED", e.message ?: "Folder list fail")
    }
  }

  private fun resolveFsPath(raw: String): String? {
    var t = raw.trim().replace('\\', '/')
    if (t.isEmpty()) return null
    val lower = t.lowercase()
    if (lower.startsWith("content://")) return null
    if (t.startsWith("file://")) t = t.removePrefix("file://")
    if (t.startsWith("/storage/") || t.startsWith("/sdcard/")) {
      return File(t).absolutePath
    }
    val prefix =
      Regex("^(?i)(internal storage|phone storage|this device)[/\\\\:\\s]+")
    t = prefix.replace(t, "").trimStart('/', ' ')
    val root = Environment.getExternalStorageDirectory()?.absolutePath ?: "/storage/emulated/0"
    return File(root, t).absolutePath
  }

  private fun countAudioInDir(dir: File, depth: Int): Int {
    if (depth > MAX_SCAN_DEPTH) return 0
    if (!dir.isDirectory || !dir.canRead()) return 0
    var audio = 0
    val files = dir.listFiles() ?: return 0
    for (f in files) {
      if (f.isDirectory) audio += countAudioInDir(f, depth + 1)
      else if (f.isFile && isAudioFileName(f.name)) audio += 1
    }
    return audio
  }

  private fun collectFsAudio(dir: File, depth: Int, rows: WritableArray) {
    if (depth > MAX_SCAN_DEPTH) return
    if (!dir.isDirectory || !dir.canRead()) return
    val files = dir.listFiles() ?: return
    for (f in files) {
      if (f.isDirectory) {
        collectFsAudio(f, depth + 1, rows)
        continue
      }
      if (!f.isFile || !isAudioFileName(f.name)) continue
      val row: WritableMap = Arguments.createMap()
      row.putString("uri", Uri.fromFile(f).toString())
      row.putString("name", f.name)
      rows.pushMap(row)
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
      collectAudioEntries(treeUri, rows)
      promise.resolve(rows)
    } catch (e: Throwable) {
      promise.reject("LIST_FAILED", e.message ?: "Folder list fail")
    }
  }

  private fun countAudioRecursive(treeUri: Uri): Int {
    var audio = 0
    val queue = ArrayDeque<Pair<Uri, Int>>()
    queue.add(treeUri to 0)
    while (queue.isNotEmpty()) {
      val (parent, depth) = queue.removeFirst()
      if (depth > MAX_SCAN_DEPTH) continue
      val parentDocId =
          if (parent == treeUri) {
            DocumentsContract.getTreeDocumentId(treeUri)
          } else {
            DocumentsContract.getDocumentId(parent)
          }
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId)
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
            val name = cursor.getString(nameIdx) ?: ""
            val childId = cursor.getString(idIdx) ?: continue
            if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
              if (depth < MAX_SCAN_DEPTH) {
                val childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
                queue.add(childUri to depth + 1)
              }
              continue
            }
            if (isAudioFileName(name)) audio += 1
          }
        }
    }
    return audio
  }

  private fun collectAudioEntries(treeUri: Uri, rows: WritableArray) {
    val queue = ArrayDeque<Pair<Uri, Int>>()
    queue.add(treeUri to 0)
    while (queue.isNotEmpty()) {
      val (parent, depth) = queue.removeFirst()
      if (depth > MAX_SCAN_DEPTH) continue
      val parentDocId =
        if (parent == treeUri) {
          DocumentsContract.getTreeDocumentId(treeUri)
        } else {
          DocumentsContract.getDocumentId(parent)
        }
      val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId)
      val projection =
        arrayOf(
          DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
      val cursor = ctx.contentResolver.query(childrenUri, projection, null, null, null)
      if (cursor == null) {
        if (parent == treeUri) throw IllegalStateException("Folder query returned null")
        continue
      }
      cursor.use {
        val idIdx = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
        val nameIdx = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
        val mimeIdx = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
        while (it.moveToNext()) {
          val mime = it.getString(mimeIdx) ?: ""
          val name = it.getString(nameIdx) ?: ""
          val childId = it.getString(idIdx) ?: continue
          if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
            if (depth < MAX_SCAN_DEPTH) {
              val childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
              queue.add(childUri to depth + 1)
            }
            continue
          }
          if (!isAudioFileName(name)) continue
          val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
          val row: WritableMap = Arguments.createMap()
          row.putString("uri", fileUri.toString())
          row.putString("name", name)
          rows.pushMap(row)
        }
      }
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