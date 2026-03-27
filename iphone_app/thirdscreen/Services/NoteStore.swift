import Foundation
import Combine

@Observable
final class NoteStore {
    private(set) var notes: [NoteItem] = []
    private(set) var links: [LinkItem] = []

    let storageKind: NoteStorageKind

    private let instanceID: UUID
    private let localKey: String
    private let localLinksKey: String
    private var saveTask: Task<Void, Never>?
    private var metadataQuery: NSMetadataQuery?
    private var queryObservers: [NSObjectProtocol] = []

    init(instanceID: UUID, storageKind: NoteStorageKind) {
        self.instanceID = instanceID
        self.storageKind = storageKind
        self.localKey = "thirdscreen.notes.\(instanceID.uuidString)"
        self.localLinksKey = "thirdscreen.links.\(instanceID.uuidString)"
        loadNotes()
        loadLinks()
        if storageKind == .icloud {
            startICloudMonitor()
        }
    }

    deinit {
        metadataQuery?.stop()
        for observer in queryObservers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    func sortedNotes(searchQuery: String = "") -> [NoteItem] {
        notes
            .filter { $0.matchesSearch(searchQuery) }
            .sorted { lhs, rhs in
                if lhs.isPinned != rhs.isPinned { return lhs.isPinned }
                return lhs.modifiedAt > rhs.modifiedAt
            }
    }

    func add() -> NoteItem {
        var note = NoteItem(storageKind: storageKind)
        note.content = ""
        notes.insert(note, at: 0)
        saveNote(note)
        return note
    }

    func update(_ note: NoteItem) {
        var updated = note
        updated.modifiedAt = Date()
        if let idx = notes.firstIndex(where: { $0.id == updated.id }) {
            notes[idx] = updated
            scheduleSaveNote(updated)
        }
    }

    func delete(_ note: NoteItem) {
        notes.removeAll { $0.id == note.id }
        deleteNotePersistence(note.id)
    }

    func togglePin(_ note: NoteItem) {
        var updated = note
        updated.isPinned.toggle()
        updated.modifiedAt = Date()
        update(updated)
    }

    // MARK: - Links API

    func sortedLinks(searchQuery: String = "") -> [LinkItem] {
        links
            .filter { $0.matchesSearch(searchQuery) }
            .sorted { lhs, rhs in
                if lhs.isPinned != rhs.isPinned { return lhs.isPinned }
                return lhs.createdAt > rhs.createdAt
            }
    }

    @discardableResult
    func addLink(url: String, title: String = "") -> LinkItem {
        let normalized = LinkItem.normalizeURL(url)
        let link = LinkItem(url: normalized, title: title, storageKind: storageKind)
        links.insert(link, at: 0)
        saveLinkPersistence(link)
        return link
    }

    func updateLink(_ link: LinkItem) {
        if let idx = links.firstIndex(where: { $0.id == link.id }) {
            links[idx] = link
            saveLinkPersistence(link)
        }
    }

    func deleteLink(_ link: LinkItem) {
        links.removeAll { $0.id == link.id }
        deleteLinkPersistence(link.id)
    }

    func toggleLinkPin(_ link: LinkItem) {
        var updated = link
        updated.isPinned.toggle()
        updateLink(updated)
    }

    func toggleChecklistItem(_ note: NoteItem, lineIndex: Int) {
        var lines = note.content.components(separatedBy: "\n")
        guard lineIndex >= 0, lineIndex < lines.count else { return }
        let line = lines[lineIndex]
        if line.hasPrefix("- [ ] ") {
            lines[lineIndex] = "- [x] " + line.dropFirst(6)
        } else if line.hasPrefix("- [x] ") {
            lines[lineIndex] = "- [ ] " + line.dropFirst(6)
        }
        var updated = note
        updated.content = lines.joined(separator: "\n")
        update(updated)
    }

    // MARK: - Unified Load/Save

    private func loadNotes() {
        switch storageKind {
        case .local: loadLocalNotes()
        case .icloud: loadICloudNotes()
        }
    }

    private func loadLinks() {
        switch storageKind {
        case .local: loadLocalLinks()
        case .icloud: loadICloudLinks()
        }
    }

    private func saveNote(_ note: NoteItem) {
        switch storageKind {
        case .local: saveLocalNotes()
        case .icloud: saveICloudNote(note)
        }
    }

    private func scheduleSaveNote(_ note: NoteItem) {
        switch storageKind {
        case .local: scheduleSaveLocalNotes()
        case .icloud: scheduleSaveICloudNote(note)
        }
    }

    private func deleteNotePersistence(_ noteID: UUID) {
        switch storageKind {
        case .local: saveLocalNotes()
        case .icloud: deleteICloudNote(noteID)
        }
    }

    private func saveLinkPersistence(_ link: LinkItem) {
        switch storageKind {
        case .local: saveLocalLinks()
        case .icloud: saveICloudLink(link)
        }
    }

    private func deleteLinkPersistence(_ linkID: UUID) {
        switch storageKind {
        case .local: saveLocalLinks()
        case .icloud: deleteICloudLink(linkID)
        }
    }

    // MARK: - Local Persistence

    private func loadLocalNotes() {
        guard let data = UserDefaults.standard.data(forKey: localKey),
              let decoded = try? JSONDecoder().decode([NoteItem].self, from: data) else {
            notes = []
            return
        }
        notes = decoded
    }

    private func saveLocalNotes() {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: localKey)
    }

    private func loadLocalLinks() {
        guard let data = UserDefaults.standard.data(forKey: localLinksKey),
              let decoded = try? JSONDecoder().decode([LinkItem].self, from: data) else {
            links = []
            return
        }
        links = decoded
    }

    private func saveLocalLinks() {
        guard let data = try? JSONEncoder().encode(links) else { return }
        UserDefaults.standard.set(data, forKey: localLinksKey)
    }

    private func scheduleSaveLocalNotes() {
        saveTask?.cancel()
        saveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self.saveLocalNotes()
        }
    }

    // MARK: - iCloud Persistence

    private var icloudNotesDirectory: URL? {
        guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
        let dir = container.appendingPathComponent("Documents/notes/\(instanceID.uuidString)", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private func icloudFileURL(for noteID: UUID) -> URL? {
        icloudNotesDirectory?.appendingPathComponent("\(noteID.uuidString).json")
    }

    private func loadICloudNotes() {
        guard let dir = icloudNotesDirectory else {
            notes = []
            return
        }
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else {
            notes = []
            return
        }
        var loaded: [NoteItem] = []
        let decoder = JSONDecoder()
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let note = try? decoder.decode(NoteItem.self, from: data) else { continue }
            loaded.append(note)
        }
        notes = loaded
    }

    private func saveICloudNote(_ note: NoteItem) {
        guard let url = icloudFileURL(for: note.id) else { return }
        guard let data = try? JSONEncoder().encode(note) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private var pendingICloudSaves: [UUID: Task<Void, Never>] = [:]

    private func scheduleSaveICloudNote(_ note: NoteItem) {
        pendingICloudSaves[note.id]?.cancel()
        pendingICloudSaves[note.id] = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self.saveICloudNote(note)
            self.pendingICloudSaves.removeValue(forKey: note.id)
        }
    }

    private func deleteICloudNote(_ noteID: UUID) {
        guard let url = icloudFileURL(for: noteID) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - iCloud Link Persistence

    private var icloudLinksDirectory: URL? {
        guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
        let dir = container.appendingPathComponent("Documents/links/\(instanceID.uuidString)", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private func icloudLinkFileURL(for linkID: UUID) -> URL? {
        icloudLinksDirectory?.appendingPathComponent("\(linkID.uuidString).json")
    }

    private func loadICloudLinks() {
        guard let dir = icloudLinksDirectory else {
            links = []
            return
        }
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else {
            links = []
            return
        }
        var loaded: [LinkItem] = []
        let decoder = JSONDecoder()
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let link = try? decoder.decode(LinkItem.self, from: data) else { continue }
            loaded.append(link)
        }
        links = loaded
    }

    private func saveICloudLink(_ link: LinkItem) {
        guard let url = icloudLinkFileURL(for: link.id) else { return }
        guard let data = try? JSONEncoder().encode(link) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func deleteICloudLink(_ linkID: UUID) {
        guard let url = icloudLinkFileURL(for: linkID) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - iCloud Monitor

    private func startICloudMonitor() {
        guard icloudNotesDirectory != nil else { return }
        let query = NSMetadataQuery()
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
        query.predicate = NSPredicate(format: "%K LIKE '*.json'", NSMetadataItemFSNameKey)

        let gathered = NotificationCenter.default.addObserver(
            forName: .NSMetadataQueryDidFinishGathering,
            object: query,
            queue: .main
        ) { [weak self] _ in
            self?.handleICloudUpdate()
        }

        let updated = NotificationCenter.default.addObserver(
            forName: .NSMetadataQueryDidUpdate,
            object: query,
            queue: .main
        ) { [weak self] _ in
            self?.handleICloudUpdate()
        }

        queryObservers = [gathered, updated]
        metadataQuery = query
        query.start()
    }

    private func handleICloudUpdate() {
        loadICloudNotes()
        loadICloudLinks()
    }
}
