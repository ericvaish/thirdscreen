//
//  LyricsCache.swift
//  thirdscreen
//

import Foundation

@Observable
@MainActor
final class LyricsCache {
    private(set) var currentSizeBytes: Int64 = 0
    private(set) var cachedCount: Int = 0

    private let cacheDir: URL
    private let fileManager = FileManager.default

    init() {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        cacheDir = appSupport.appendingPathComponent("ThirdScreen/LyricsCache", isDirectory: true)
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        refreshStats()
    }

    // MARK: - Public

    func lookup(track: String, artist: String, album: String) -> CachedLyrics? {
        let file = cacheFile(for: track, artist: artist, album: album)
        guard let data = try? Data(contentsOf: file),
              let entry = try? JSONDecoder().decode(CachedLyrics.self, from: data) else { return nil }
        return entry
    }

    func store(track: String, artist: String, album: String, lyrics: CachedLyrics) {
        let maxCount = UserDefaults.standard.integer(forKey: "lyricsCacheMaxCount")
        let maxMB = UserDefaults.standard.integer(forKey: "lyricsCacheMaxSizeMB")
        let effectiveMaxCount = maxCount > 0 ? maxCount : 200
        let effectiveMaxBytes: Int64 = Int64(maxMB > 0 ? maxMB : 100) * 1_000_000

        evictIfNeeded(maxCount: effectiveMaxCount, maxBytes: effectiveMaxBytes)

        let file = cacheFile(for: track, artist: artist, album: album)
        guard let data = try? JSONEncoder().encode(lyrics) else { return }
        try? data.write(to: file, options: .atomic)
        refreshStats()
    }

    func clearAll() {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil) else { return }
        for file in files where file.pathExtension == "json" {
            try? fileManager.removeItem(at: file)
        }
        refreshStats()
    }

    func refreshStats() {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: [.fileSizeKey]) else {
            currentSizeBytes = 0
            cachedCount = 0
            return
        }
        let jsonFiles = files.filter { $0.pathExtension == "json" }
        cachedCount = jsonFiles.count
        currentSizeBytes = jsonFiles.reduce(into: Int64(0)) { total, file in
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            total += Int64(size)
        }
    }

    // MARK: - Private

    private func cacheFile(for track: String, artist: String, album: String) -> URL {
        let key = "\(track)|\(artist)|\(album)"
        let hash = key.data(using: .utf8)!.map { String(format: "%02x", $0) }.joined()
        let filename = String(hash.prefix(40))
        return cacheDir.appendingPathComponent("\(filename).json")
    }

    private func evictIfNeeded(maxCount: Int, maxBytes: Int64) {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]) else { return }
        var jsonFiles = files.filter { $0.pathExtension == "json" }

        // Sort oldest first
        jsonFiles.sort { a, b in
            let dateA = (try? a.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
            let dateB = (try? b.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
            return dateA < dateB
        }

        var totalSize = jsonFiles.reduce(into: Int64(0)) { total, file in
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            total += Int64(size)
        }
        var count = jsonFiles.count

        // Evict oldest until within limits (leave room for 1 new entry)
        var i = 0
        while i < jsonFiles.count && (count >= maxCount || totalSize >= maxBytes) {
            let file = jsonFiles[i]
            let size = Int64((try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0)
            try? fileManager.removeItem(at: file)
            totalSize -= size
            count -= 1
            i += 1
        }
    }
}

struct CachedLyrics: Codable {
    let instrumental: Bool
    let syncedLyrics: String?
    let plainLyrics: String?
}
