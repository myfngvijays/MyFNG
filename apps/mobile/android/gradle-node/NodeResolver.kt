package expo.modules.plugin

import java.io.File
import java.util.Properties

/**
 * Android Studio (Dock/GUI) often has no Homebrew/nvm PATH, so bare `node` fails.
 * Prefer NODE_BINARY, then android/local.properties `node.executable`, then known install paths.
 */
object NodeResolver {
  fun get(rootDir: File? = null): String {
    System.getenv("NODE_BINARY")?.takeIf { File(it).canExecute() }?.let { return it }

    val roots = linkedSetOf<File>()
    rootDir?.let { roots.add(it.absoluteFile) }
    System.getProperty("user.dir")?.let { roots.add(File(it).absoluteFile) }

    for (root in roots) {
      var dir: File? = root
      repeat(8) {
        val current = dir ?: return@repeat
        val local = File(current, "local.properties")
        if (local.isFile) {
          val props = Properties()
          local.inputStream().use { props.load(it) }
          val fromLocal = props.getProperty("node.executable")
          if (!fromLocal.isNullOrBlank() && File(fromLocal).canExecute()) {
            return fromLocal
          }
        }
        dir = current.parentFile
      }
    }

    val home = System.getProperty("user.home") ?: ""
    listOf(
      "$home/nodejs/bin/node",
      "/usr/local/bin/node",
      "/opt/homebrew/bin/node",
    ).firstOrNull { File(it).canExecute() }?.let { return it }

    return "node"
  }
}
