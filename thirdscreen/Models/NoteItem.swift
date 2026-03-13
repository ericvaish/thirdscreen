import Foundation

enum NoteStorageKind: String, Codable, CaseIterable {
    case local
    case icloud

    var label: String {
        switch self {
        case .local: return "Local Notes"
        case .icloud: return "iCloud Notes"
        }
    }

    var iconName: String {
        switch self {
        case .local: return "internaldrive"
        case .icloud: return "icloud"
        }
    }
}

struct NoteItem: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var content: String
    var isPinned: Bool
    var storageKind: NoteStorageKind
    var createdAt: Date
    var modifiedAt: Date

    init(
        id: UUID = UUID(),
        content: String = "",
        isPinned: Bool = false,
        storageKind: NoteStorageKind = .local,
        createdAt: Date = Date(),
        modifiedAt: Date = Date()
    ) {
        self.id = id
        self.content = content
        self.isPinned = isPinned
        self.storageKind = storageKind
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
    }

    var titlePreview: String {
        let firstLine = content.prefix(while: { $0 != "\n" })
        let trimmed = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "New Note" }
        // Strip checkbox prefix for display
        if trimmed.hasPrefix("- [ ] ") { return String(trimmed.dropFirst(6)) }
        if trimmed.hasPrefix("- [x] ") { return String(trimmed.dropFirst(6)) }
        return String(trimmed.prefix(60))
    }

    var checklistItemCount: Int {
        content.components(separatedBy: "\n").filter { $0.hasPrefix("- [ ] ") || $0.hasPrefix("- [x] ") }.count
    }

    var checkedItemCount: Int {
        content.components(separatedBy: "\n").filter { $0.hasPrefix("- [x] ") }.count
    }

    func matchesSearch(_ query: String) -> Bool {
        guard !query.isEmpty else { return true }
        return content.localizedCaseInsensitiveContains(query)
    }
}

// MARK: - Link Item

struct LinkItem: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var url: String
    var title: String
    var isPinned: Bool
    var storageKind: NoteStorageKind
    var createdAt: Date

    init(
        id: UUID = UUID(),
        url: String,
        title: String = "",
        isPinned: Bool = false,
        storageKind: NoteStorageKind = .local,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.url = url
        self.title = title.isEmpty ? url : title
        self.isPinned = isPinned
        self.storageKind = storageKind
        self.createdAt = createdAt
    }

    var displayTitle: String {
        if !title.isEmpty && title != url {
            return title
        }
        // Strip protocol and trailing slash for display
        var display = url
        for prefix in ["https://", "http://", "www."] {
            if display.hasPrefix(prefix) {
                display = String(display.dropFirst(prefix.count))
            }
        }
        if display.hasSuffix("/") { display = String(display.dropLast()) }
        return String(display.prefix(60))
    }

    var hostname: String {
        guard let components = URLComponents(string: url),
              let host = components.host else {
            return url
        }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    func matchesSearch(_ query: String) -> Bool {
        guard !query.isEmpty else { return true }
        return url.localizedCaseInsensitiveContains(query)
            || title.localizedCaseInsensitiveContains(query)
    }

    static func looksLikeURL(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains(" "), !trimmed.contains("\n") else { return false }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return true }
        // Match patterns like "example.com", "foo.co.uk/path"
        let pattern = #"^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+(/.*)?$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
    }

    static func normalizeURL(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }
}
