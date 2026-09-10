import Foundation
import CallKit
import UIKit

@objc(MyFNGCallerId)
class CallerIdModule: NSObject {
  static let appGroup = "group.com.myfng.app"
  static let extensionId = "com.myfng.app.callerid"

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func syncAuth(_ apiUrl: String, token: String) {}

  @objc func setPendingCall(_ map: NSDictionary) {}

  @objc func clearPendingCall() {}

  @objc func setEnabled(_ enabled: Bool) {
    UserDefaults(suiteName: Self.appGroup)?.set(enabled, forKey: "enabled")
  }

  @objc func requestOverlayPermission() {
    openIdentificationSettings()
  }

  @objc func preview() {}

  @objc func openIdentificationSettings() {
    if #available(iOS 13.4, *) {
      CXCallDirectoryManager.sharedInstance.openSettings { _ in }
    }
  }

  @objc func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension(withIdentifier: Self.extensionId) { status, error in
      let enabled = status == .enabled
      let count = (UserDefaults(suiteName: Self.appGroup)?.array(forKey: "entries") as? [Any])?.count ?? 0
      resolve([
        "supported": true,
        "overlay": false,
        "enabled": enabled,
        "directoryEnabled": enabled,
        "count": count,
        "error": error?.localizedDescription ?? "",
      ])
    }
  }

  @objc func syncDirectory(
    _ entries: NSArray,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    var cleaned: [[String: String]] = []
    var seen = Set<String>()
    for item in entries {
      guard let row = item as? NSDictionary else { continue }
      let phone = String(row["phone"] as? String ?? row["n"] as? String ?? "")
      let label = String(row["label"] as? String ?? row["l"] as? String ?? "").trimmingCharacters(in: .whitespaces)
      guard let number = Self.phoneNumber(phone), !label.isEmpty else { continue }
      let key = String(number)
      if seen.contains(key) { continue }
      seen.insert(key)
      cleaned.append(["n": key, "l": String(label.prefix(50))])
    }
    cleaned.sort { ($0["n"] ?? "") < ($1["n"] ?? "") }

    let defaults = UserDefaults(suiteName: Self.appGroup)
    defaults?.set(cleaned, forKey: "entries")
    defaults?.synchronize()

    if let url = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup)?
      .appendingPathComponent("callerid.json"),
      let data = try? JSONSerialization.data(withJSONObject: cleaned) {
      try? data.write(to: url, options: .atomic)
    }

    CXCallDirectoryManager.sharedInstance.reloadExtension(withIdentifier: Self.extensionId) { error in
      if let error {
        resolve(["ok": false, "count": cleaned.count, "error": error.localizedDescription])
      } else {
        resolve(["ok": true, "count": cleaned.count])
      }
    }
  }

  private static func phoneNumber(_ raw: String) -> CXCallDirectoryPhoneNumber? {
    var digits = raw.filter(\.isNumber)
    if digits.hasPrefix("0") { digits = String(digits.dropFirst()) }
    if digits.count == 10 { digits = "91" + digits }
    if digits.count < 11 || digits.count > 15 { return nil }
    return CXCallDirectoryPhoneNumber(digits)
  }
}
