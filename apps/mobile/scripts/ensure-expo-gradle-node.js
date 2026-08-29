#!/usr/bin/env node
/**
 * Android Studio Gradle has no node on PATH. Re-apply Expo autolinking node resolver
 * after npm/pnpm install (node_modules is not committed).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'android/gradle-node/NodeResolver.kt');
const destDir = path.join(
  root,
  'node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin-shared/src/main/kotlin/expo/modules/plugin',
);
const dest = path.join(destDir, 'NodeResolver.kt');

const setupJdk = path.join(root, 'android/setup-studio-jdk.sh');
if (fs.existsSync(setupJdk)) {
  try {
    require('child_process').execFileSync('bash', [setupJdk], { stdio: 'ignore' });
  } catch {
    // Overlay is optional when Android Studio JBR is missing.
  }
}

if (!fs.existsSync(src)) process.exit(0);
if (!fs.existsSync(destDir)) process.exit(0);

fs.copyFileSync(src, dest);

function replaceOnce(file, from, to) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(from) || before.includes(to)) return;
  fs.writeFileSync(file, before.split(from).join(to));
}

const plugin = path.join(
  root,
  'node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingSettingsPlugin.kt',
);
replaceOnce(
  plugin,
  'env.commandLine("node", "--print", "require.resolve(\'expo-modules-autolinking/package.json\'',
  'env.commandLine(NodeResolver.get(settings.rootDir), "--print", "require.resolve(\'expo-modules-autolinking/package.json\'',
);

const ext = path.join(
  root,
  'node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingSettingsExtension.kt',
);
replaceOnce(
  ext,
  'env.commandLine("node", "--print", "require.resolve(\'@react-native/gradle-plugin/package.json\'',
  'env.commandLine(NodeResolver.get(settings.rootDir), "--print", "require.resolve(\'@react-native/gradle-plugin/package.json\'',
);
replaceOnce(
  ext,
  'env.commandLine("node", "--print", "require.resolve(\'react-native/package.json\')")',
  'env.commandLine(NodeResolver.get(settings.rootDir), "--print", "require.resolve(\'react-native/package.json\')")',
);

const builder = path.join(
  root,
  'node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin-shared/src/main/kotlin/expo/modules/plugin/AutolinkigCommandBuilder.kt',
);
if (fs.existsSync(builder)) {
  let text = fs.readFileSync(builder, 'utf8');
  if (text.includes('"node",') && !text.includes('NodeResolver.get()')) {
    text = text.replace(
      '  private val baseCommand = listOf(\n    "node",',
      '  private val baseCommand: List<String>\n    get() = listOf(\n      NodeResolver.get(),',
    );
    fs.writeFileSync(builder, text);
  }
}

const expoHelper = path.join(
  root,
  'node_modules/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/gradle/ExpoGradleHelperExtension.kt',
);
if (fs.existsSync(expoHelper)) {
  let helper = fs.readFileSync(expoHelper, 'utf8');
  if (helper.includes('env.commandLine("node", "--print", "require.resolve(\'react-native/package.json\')")')) {
    helper = helper.replace(
      'env.commandLine("node", "--print", "require.resolve(\'react-native/package.json\')")',
      'env.commandLine(resolveNode(project), "--print", "require.resolve(\'react-native/package.json\')")',
    );
    if (!helper.includes('private fun resolveNode(project: Project)')) {
      helper = helper.replace(
        /    return reactNativeVersion\n  }\n}\n?\s*$/,
        `    return reactNativeVersion
  }

  private fun resolveNode(project: Project): String {
    System.getenv("NODE_BINARY")?.takeIf { File(it).canExecute() }?.let { return it }
    var dir: File? = project.rootDir
    repeat(8) {
      val current = dir ?: return@repeat
      val local = File(current, "local.properties")
      if (local.isFile) {
        val props = Properties()
        local.inputStream().use { props.load(it) }
        val fromLocal = props.getProperty("node.executable")
        if (!fromLocal.isNullOrBlank() && File(fromLocal).canExecute()) return fromLocal
      }
      dir = current.parentFile
    }
    val home = System.getProperty("user.home") ?: ""
    listOf("\$home/nodejs/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node")
      .firstOrNull { File(it).canExecute() }?.let { return it }
    return "node"
  }
}
`,
      );
    }
    fs.writeFileSync(expoHelper, helper);
  }
}
