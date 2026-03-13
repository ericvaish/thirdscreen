import Foundation
import OSLog

/// File-based persistence for critical app data (layout, workspace, card
/// settings) in ~/Library/Application Support/thirdscreen/.
///
/// For a sandboxed app this resolves inside the container, which is stable
/// across normal launches and App Store updates.  Direct file I/O is more
/// reliable than @AppStorage for large Data blobs and gives us explicit
/// control over read/write timing.
enum StableDefaults {
    private static let logger = Logger(subsystem: "thirdscreen", category: "Persistence")

    private static let baseDir: URL = {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
        let dir = appSupport.appendingPathComponent("thirdscreen", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - Layout

    private static let layoutFile = baseDir.appendingPathComponent("layout.json")

    static func saveLayout(_ data: Data) {
        write(data, to: layoutFile, label: "layout")
    }

    static func loadLayout() -> Data? {
        read(from: layoutFile, label: "layout")
    }

    // MARK: - Workspace

    private static let workspaceFile = baseDir.appendingPathComponent("workspace.json")

    static func saveWorkspace(_ data: Data) {
        write(data, to: workspaceFile, label: "workspace")
    }

    static func loadWorkspace() -> Data? {
        read(from: workspaceFile, label: "workspace")
    }

    // MARK: - Card Settings

    private static let cardSettingsFile = baseDir.appendingPathComponent("cardSettings.json")

    static func saveCardSettings(_ data: Data) {
        write(data, to: cardSettingsFile, label: "cardSettings")
    }

    static func loadCardSettings() -> Data? {
        read(from: cardSettingsFile, label: "cardSettings")
    }

    // MARK: - Generic UserDefaults keys

    private static let preferencesFile = baseDir.appendingPathComponent("preferences.json")

    /// Save a set of UserDefaults keys to a preferences file.
    static func savePreferences(keys: [String]) {
        let defaults = UserDefaults.standard
        var dict: [String: Any] = [:]
        for key in keys {
            if let value = defaults.object(forKey: key) {
                dict[key] = value
            }
        }
        guard !dict.isEmpty else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: dict, options: []) else { return }
        write(data, to: preferencesFile, label: "preferences")
    }

    /// Restore UserDefaults keys from the preferences file (only sets keys
    /// that are currently missing from UserDefaults).
    static func restorePreferences() {
        guard let data = read(from: preferencesFile, label: "preferences"),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        let defaults = UserDefaults.standard
        var count = 0
        for (key, value) in dict {
            if defaults.object(forKey: key) == nil {
                defaults.set(value, forKey: key)
                count += 1
            }
        }
        if count > 0 {
            logger.info("restored \(count) preference keys")
        }
    }

    // MARK: - Helpers

    /// No-op bootstrap kept for backward compatibility; remove once old
    /// callers are cleaned up.
    static func bootstrap() {}
    static func save() {}

    private static func write(_ data: Data, to url: URL, label: String) {
        do {
            try data.write(to: url, options: .atomic)
            logger.debug("\(label): wrote \(data.count) bytes")
        } catch {
            logger.error("\(label): write failed – \(error.localizedDescription)")
        }
    }

    private static func read(from url: URL, label: String) -> Data? {
        guard FileManager.default.fileExists(atPath: url.path) else {
            logger.debug("\(label): no file at \(url.path)")
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            logger.debug("\(label): read \(data.count) bytes")
            return data
        } catch {
            logger.error("\(label): read failed – \(error.localizedDescription)")
            return nil
        }
    }
}
