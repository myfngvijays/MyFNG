import Foundation
import CallKit

final class CallDirectoryHandler: CXCallDirectoryProvider {
  static let appGroup = "group.com.myfng.app"
  static let fileName = "callerid.json"

  override func beginRequest(with context: CXCallDirectoryExtensionContext) {
    context.delegate = self
    addIdentification(to: context)
    context.completeRequest()
  }

  private func addIdentification(to context: CXCallDirectoryExtensionContext) {
    if context.isIncremental {
      context.removeAllIdentificationEntries()
    }

    guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return }
    let rows = (defaults.array(forKey: "entries") as? [[String: Any]]) ?? loadFileEntries()

    var pairs: [(CXCallDirectoryPhoneNumber, String)] = []
    var seen = Set<CXCallDirectoryPhoneNumber>()
    for row in rows {
      let raw = String(row["n"] as? String ?? row["phone"] as? String ?? "")
      let label = String(row["l"] as? String ?? row["label"] as? String ?? "").trimmingCharacters(in: .whitespaces)
      guard let number = Self.phoneNumber(raw), !label.isEmpty, !seen.contains(number) else { continue }
      seen.insert(number)
      pairs.append((number, String(label.prefix(50))))
    }
    pairs.sort { $0.0 < $1.0 }
    for (number, label) in pairs {
      context.addIdentificationEntry(withNextSequentialPhoneNumber: number, label: label)
    }
  }

  private func loadFileEntries() -> [[String: Any]] {
    guard
      let url = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup)?
        .appendingPathComponent(Self.fileName),
      let data = try? Data(contentsOf: url),
      let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return json
  }

  static func phoneNumber(_ raw: String) -> CXCallDirectoryPhoneNumber? {
    var digits = raw.filter(\.isNumber)
    if digits.hasPrefix("0") { digits = String(digits.dropFirst()) }
    if digits.count == 10 { digits = "91" + digits }
    if digits.count < 11 || digits.count > 15 { return nil }
    return CXCallDirectoryPhoneNumber(digits)
  }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
  func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
    NSLog("MyFNG caller-id extension failed: %@", error.localizedDescription)
  }
}
