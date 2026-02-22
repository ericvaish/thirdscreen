import Foundation
import AppKit

@Observable
final class ShortcutsService {
    private let storageKey = "thirdscreen.shortcuts.quickActions"

    private(set) var actions: [ShortcutQuickAction] = []
    private(set) var lastRunError: String?
    private(set) var lastRunMessage: String?

    init() {
        load()
    }

    func addAction(named rawName: String, symbolName: String) {
        clearMessages()
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        let alreadyExists = actions.contains { existing in
            existing.name.caseInsensitiveCompare(name) == .orderedSame
        }
        guard !alreadyExists else {
            lastRunError = "A shortcut named \"\(name)\" already exists."
            return
        }

        actions.append(ShortcutQuickAction(name: name, symbolName: symbolName))
        save()
    }

    func removeAction(_ action: ShortcutQuickAction) {
        actions.removeAll { $0.id == action.id }
        save()
    }

    func runAction(_ action: ShortcutQuickAction) {
        clearMessages()
        guard let url = runURL(for: action.name) else {
            lastRunError = "Could not create a valid URL for this shortcut."
            return
        }

        if NSWorkspace.shared.open(url) {
            lastRunMessage = "Ran \"\(action.name)\"."
        } else {
            lastRunError = "Unable to open Shortcuts. Make sure the Shortcuts app is installed."
        }
    }

    func openShortcutsApp() {
        clearMessages()
        guard let url = URL(string: "shortcuts://") else {
            lastRunError = "Unable to open Shortcuts."
            return
        }
        if !NSWorkspace.shared.open(url) {
            lastRunError = "Unable to open Shortcuts."
        }
    }

    private func runURL(for shortcutName: String) -> URL? {
        var components = URLComponents()
        components.scheme = "shortcuts"
        components.host = "run-shortcut"
        components.queryItems = [
            URLQueryItem(name: "name", value: shortcutName)
        ]
        return components.url
    }

    private func clearMessages() {
        lastRunError = nil
        lastRunMessage = nil
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([ShortcutQuickAction].self, from: data) else {
            return
        }
        actions = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(actions) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}
