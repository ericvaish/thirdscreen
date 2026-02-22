//
//  SpotifyService.swift
//  thirdscreen
//

import Foundation
import AppKit
import AuthenticationServices
import CryptoKit

private let clientIDKey = "SpotifyClientID"
private let redirectURI = "thirdscreen://callback"
private let tokenStorageKey = "SpotifyAccessToken"
private let refreshTokenStorageKey = "SpotifyRefreshToken"
private let tokenExpiryKey = "SpotifyTokenExpiry"
private let tokenBundleStorageKey = "SpotifyTokenBundle"
private let scopes = "user-read-playback-state user-modify-playback-state user-read-currently-playing"

struct LyricsLine: Identifiable {
    let id = UUID()
    let startMs: Int
    let text: String
}

enum RepeatState: String, CaseIterable {
    case off
    case context  // repeat playlist/album
    case track    // repeat one track

    var apiValue: String { rawValue }
    var next: RepeatState {
        switch self {
        case .off: return .context
        case .context: return .track
        case .track: return .off
        }
    }
}

private struct SpotifyTokenBundle: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiry: Date?
}

@Observable
final class SpotifyService {
    private(set) var isConnected = false
    private(set) var isDemoMode = false
    private(set) var currentTrack: String?
    private(set) var currentArtist: String?
    private(set) var currentAlbum: String?
    private(set) var albumArtURL: URL?
    private(set) var isPlaying = false
    private(set) var trackDurationMs: Int?
    private(set) var progressMs: Int?
    private(set) var connectionError: String?
    private(set) var isConnecting = false
    private(set) var lyricsLines: [LyricsLine] = []
    private(set) var plainLyrics: String?
    private(set) var isInstrumental = false
    private(set) var isLoadingLyrics = false
    private(set) var shuffleState = false
    private(set) var repeatState: RepeatState = .off

    private var refreshTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private var lastLyricsTrackKey: String?
    private var activeDeviceId: String?
    private var cachedAccessToken: String?
    private var cachedRefreshToken: String?
    private var cachedTokenExpiry: Date?
    private var hasLoadedTokenCache = false

    private var clientID: String {
        (Bundle.main.object(forInfoDictionaryKey: clientIDKey) as? String) ?? ""
    }

    init() {
        if hasStoredToken() {
            Task { @MainActor in await restoreSession() }
        }
    }

    private func hasStoredToken() -> Bool {
        loadTokenCacheIfNeeded()
        return cachedAccessToken != nil
    }

    private func loadTokenCacheIfNeeded() {
        guard !hasLoadedTokenCache else { return }
        hasLoadedTokenCache = true

        if let bundleData = KeychainHelper.data(forKey: tokenBundleStorageKey, service: KeychainHelper.spotifyService),
           let bundle = try? JSONDecoder().decode(SpotifyTokenBundle.self, from: bundleData),
           !bundle.accessToken.isEmpty {
            cachedAccessToken = bundle.accessToken
            cachedRefreshToken = bundle.refreshToken
            cachedTokenExpiry = bundle.expiry
            return
        }

        if let access = KeychainHelper.string(forKey: tokenStorageKey, service: KeychainHelper.spotifyService) {
            let refresh = KeychainHelper.string(forKey: refreshTokenStorageKey, service: KeychainHelper.spotifyService)
            let expiry = KeychainHelper.date(forKey: tokenExpiryKey, service: KeychainHelper.spotifyService)
            persistTokens(accessToken: access, refreshToken: refresh, expiry: expiry)
            KeychainHelper.delete(
                keys: [tokenStorageKey, refreshTokenStorageKey, tokenExpiryKey],
                service: KeychainHelper.spotifyService
            )
            return
        }

        if let legacy = UserDefaults.standard.string(forKey: tokenStorageKey) {
            migrateFromUserDefaults(accessToken: legacy)
        }
    }

    private func migrateFromUserDefaults(accessToken: String) {
        let refresh = UserDefaults.standard.string(forKey: refreshTokenStorageKey)
        let expiry = UserDefaults.standard.object(forKey: tokenExpiryKey) as? Date
        persistTokens(accessToken: accessToken, refreshToken: refresh, expiry: expiry)
        UserDefaults.standard.removeObject(forKey: tokenStorageKey)
        UserDefaults.standard.removeObject(forKey: refreshTokenStorageKey)
        UserDefaults.standard.removeObject(forKey: tokenExpiryKey)
    }

    private func persistTokens(accessToken: String, refreshToken: String?, expiry: Date?) {
        cachedAccessToken = accessToken
        if let refreshToken {
            cachedRefreshToken = refreshToken
        }
        if let expiry {
            cachedTokenExpiry = expiry
        }

        let bundle = SpotifyTokenBundle(
            accessToken: accessToken,
            refreshToken: cachedRefreshToken,
            expiry: cachedTokenExpiry
        )
        if let data = try? JSONEncoder().encode(bundle) {
            _ = KeychainHelper.set(data, forKey: tokenBundleStorageKey, service: KeychainHelper.spotifyService)
        }
    }

    func connect() {
        guard !clientID.isEmpty else {
            connectionError = "Add SpotifyClientID to Info.plist. Create an app at developer.spotify.com and add thirdscreen://callback as redirect URI."
            return
        }
        isConnecting = true
        connectionError = nil
        Task { @MainActor in await performOAuth() }
    }

    @MainActor
    private func performOAuth() async {
        defer { isConnecting = false }
        let codeVerifier = generateCodeVerifier()
        guard let codeChallenge = createCodeChallenge(from: codeVerifier) else {
            connectionError = "Failed to generate auth challenge"
            return
        }
        let state = generateCodeVerifier()

        var components = URLComponents(string: "https://accounts.spotify.com/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "scope", value: scopes),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "state", value: state),
        ]
        guard let authURL = components.url else { return }

        let callbackURL: URL? = await withCheckedContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: "thirdscreen"
            ) { callbackURL, error in
                guard error == nil else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.presentationContextProvider = SessionContextProvider.shared
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        guard let callbackURL else {
            connectionError = "Authorization was cancelled or failed"
            return
        }

        let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        let code = callbackComponents?.queryItems?.first(where: { $0.name == "code" })?.value
        guard let code else {
            let error = callbackComponents?.queryItems?.first(where: { $0.name == "error" })?.value
            connectionError = error.map { "Spotify error: \($0)" } ?? "Failed to get authorization code"
            return
        }

        guard await exchangeCodeForTokens(code: code, codeVerifier: codeVerifier) else {
            return
        }

        isConnected = true
        isDemoMode = false
        startPlaybackPolling()
    }

    @MainActor
    private func restoreSession() async {
        guard await refreshAccessTokenIfNeeded() else {
            clearStoredTokens()
            return
        }
        isConnected = true
        isDemoMode = false
        startPlaybackPolling()
    }

    private func exchangeCodeForTokens(code: String, codeVerifier: String) async -> Bool {
        var request = URLRequest(url: URL(string: "https://accounts.spotify.com/api/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirectURI,
            "client_id": clientID,
            "code_verifier": codeVerifier,
        ].map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            connectionError = "Failed to get access token"
            return false
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String else {
            connectionError = "Invalid token response"
            return false
        }

        let expiresIn = (json["expires_in"] as? Int) ?? 3600
        let expiryDate = Date().addingTimeInterval(TimeInterval(expiresIn))
        let refresh = json["refresh_token"] as? String
        persistTokens(accessToken: accessToken, refreshToken: refresh, expiry: expiryDate)
        return true
    }

    private func clearStoredTokens() {
        cachedAccessToken = nil
        cachedRefreshToken = nil
        cachedTokenExpiry = nil
        KeychainHelper.delete(
            keys: [tokenBundleStorageKey, tokenStorageKey, refreshTokenStorageKey, tokenExpiryKey],
            service: KeychainHelper.spotifyService
        )
        UserDefaults.standard.removeObject(forKey: tokenStorageKey)
        UserDefaults.standard.removeObject(forKey: refreshTokenStorageKey)
        UserDefaults.standard.removeObject(forKey: tokenExpiryKey)
    }

    private func refreshAccessTokenIfNeeded() async -> Bool {
        loadTokenCacheIfNeeded()

        let expiry = cachedTokenExpiry ?? UserDefaults.standard.object(forKey: tokenExpiryKey) as? Date
        if let expiry, expiry.timeIntervalSinceNow > 60 { return true }

        guard let refreshToken = cachedRefreshToken ?? UserDefaults.standard.string(forKey: refreshTokenStorageKey) else {
            return false
        }

        var request = URLRequest(url: URL(string: "https://accounts.spotify.com/api/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = [
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
            "client_id": clientID,
        ].map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            return false
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String else {
            return false
        }

        let expiresIn = (json["expires_in"] as? Int) ?? 3600
        let expiryDate = Date().addingTimeInterval(TimeInterval(expiresIn))
        let refresh = json["refresh_token"] as? String
        persistTokens(accessToken: accessToken, refreshToken: refresh, expiry: expiryDate)
        return true
    }

    private func apiRequest(_ path: String, method: String = "GET", body: Data? = nil) async -> (Data?, Int)? {
        guard await refreshAccessTokenIfNeeded() else { return nil }
        guard let token = cachedAccessToken ?? UserDefaults.standard.string(forKey: tokenStorageKey) else { return nil }

        var request = URLRequest(url: URL(string: "https://api.spotify.com/v1\(path)")!)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse else { return nil }
        return (data, http.statusCode)
    }

    private func fetchPlaybackState() async {
        guard let (data, status) = await apiRequest("/me/player") else { return }
        if status == 204 {
            await MainActor.run {
                currentTrack = nil
                currentArtist = nil
                currentAlbum = nil
                albumArtURL = nil
                isPlaying = false
                trackDurationMs = nil
                progressMs = nil
                shuffleState = false
                repeatState = .off
                activeDeviceId = nil
                lyricsLines = []
                plainLyrics = nil
                lastLyricsTrackKey = nil
            }
            return
        }
        guard status == 200, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        let isPlayingVal = json["is_playing"] as? Bool ?? false
        let progressVal = json["progress_ms"] as? Int
        let shuffleVal = json["shuffle_state"] as? Bool ?? false
        let repeatVal = (json["repeat_state"] as? String).flatMap { RepeatState(rawValue: $0) } ?? .off
        let deviceId = (json["device"] as? [String: Any])?["id"] as? String
        var track: String?
        var artist: String?
        var album: String?
        var artURL: URL?
        var durationMs: Int?

        if let item = json["item"] as? [String: Any] {
            track = item["name"] as? String
            durationMs = item["duration_ms"] as? Int
            if let artists = item["artists"] as? [[String: Any]], let first = artists.first {
                artist = first["name"] as? String
            }
            if let albumObj = item["album"] as? [String: Any] {
                album = albumObj["name"] as? String
                if let images = albumObj["images"] as? [[String: Any]],
                   let firstImg = images.first,
                   let urlStr = firstImg["url"] as? String {
                    artURL = URL(string: urlStr)
                }
            }
        }

        await MainActor.run {
            currentTrack = track
            currentArtist = artist
            currentAlbum = album
            albumArtURL = artURL
            isPlaying = isPlayingVal
            trackDurationMs = durationMs
            progressMs = progressVal
            shuffleState = shuffleVal
            repeatState = repeatVal
            activeDeviceId = deviceId
        }

        if let track, let artist, let album, let durationMs, durationMs > 0 {
            let key = "\(track)|\(artist)|\(album)"
            if lastLyricsTrackKey != key {
                await MainActor.run {
                    lyricsLines = []
                    plainLyrics = nil
                    isLoadingLyrics = true
                }
                lastLyricsTrackKey = key
                await fetchLyrics(track: track, artist: artist, album: album, durationSeconds: durationMs / 1000, forKey: key)
            }
        } else {
            await MainActor.run {
                lastLyricsTrackKey = nil
                lyricsLines = []
                plainLyrics = nil
                isLoadingLyrics = false
            }
        }
    }

    private func fetchLyrics(track: String, artist: String, album: String, durationSeconds: Int, forKey key: String) async {
        var components = URLComponents(string: "https://lrclib.net/api/get")!
        components.queryItems = [
            URLQueryItem(name: "track_name", value: track),
            URLQueryItem(name: "artist_name", value: artist),
            URLQueryItem(name: "album_name", value: album),
            URLQueryItem(name: "duration", value: String(durationSeconds)),
        ]
        guard let url = components.url else { return }

        var request = URLRequest(url: url)
        request.setValue("ThirdScreen/1.0 (https://github.com)", forHTTPHeaderField: "User-Agent")

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            await MainActor.run {
                if lastLyricsTrackKey == key {
                    lyricsLines = []
                    plainLyrics = nil
                    isInstrumental = false
                }
                isLoadingLyrics = false
            }
            return
        }

        let instrumental = json["instrumental"] as? Bool ?? false
        let plain = json["plainLyrics"] as? String
        let synced = json["syncedLyrics"] as? String

        await MainActor.run {
            guard lastLyricsTrackKey == key else {
                isLoadingLyrics = false
                return
            }
            isLoadingLyrics = false
            if instrumental {
                lyricsLines = []
                plainLyrics = "Instrumental"
                isInstrumental = true
            } else if let synced, !synced.isEmpty {
                lyricsLines = parseLRCLyrics(synced)
                plainLyrics = nil
                isInstrumental = false
            } else if let plain, !plain.isEmpty {
                lyricsLines = []
                plainLyrics = stripTimestampsFromText(plain)
                isInstrumental = false
            } else {
                lyricsLines = []
                plainLyrics = nil
                isInstrumental = false
            }
        }
    }

    private func stripTimestampsFromText(_ text: String) -> String {
        var result = text
        result = result.replacingOccurrences(of: #"\[\d+:\d+\.\d+\]"#, with: "", options: .regularExpression)
        result = result.replacingOccurrences(of: #"\[\d+:\d+\]"#, with: "", options: .regularExpression)
        return result.trimmingCharacters(in: .whitespaces)
    }

    private func parseLRCLyrics(_ lrc: String) -> [LyricsLine] {
        let pattern = #"\[(\d+):(\d+)\.(\d+)\]\s*(.*)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        var lines: [LyricsLine] = []
        let range = NSRange(lrc.startIndex..., in: lrc)
        regex.enumerateMatches(in: lrc, range: range) { match, _, _ in
            guard let m = match, m.numberOfRanges >= 5,
                  let minRange = Range(m.range(at: 1), in: lrc),
                  let secRange = Range(m.range(at: 2), in: lrc),
                  let centiRange = Range(m.range(at: 3), in: lrc),
                  let textRange = Range(m.range(at: 4), in: lrc),
                  let min = Int(lrc[minRange]), let sec = Int(lrc[secRange]), let centi = Int(lrc[centiRange]) else { return }
            let text = stripTimestampsFromText(String(lrc[textRange]))
            guard !text.isEmpty else { return }
            let startMs = min * 60000 + sec * 1000 + centi * 10
            lines.append(LyricsLine(startMs: startMs, text: text))
        }
        return lines
    }

    private func startPlaybackPolling() {
        pollTask?.cancel()
        pollTask = Task { @MainActor in
            while !Task.isCancelled {
                await fetchPlaybackState()
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    func disconnect() {
        pollTask?.cancel()
        pollTask = nil
        isConnected = false
        isDemoMode = false
        currentTrack = nil
        currentArtist = nil
        currentAlbum = nil
        albumArtURL = nil
        trackDurationMs = nil
        progressMs = nil
        lyricsLines = []
        plainLyrics = nil
        isLoadingLyrics = false
        shuffleState = false
        repeatState = .off
        activeDeviceId = nil
        lastLyricsTrackKey = nil
        connectionError = nil
        clearStoredTokens()
    }

    func startDemoMode() {
        isDemoMode = true
        isConnected = true
        currentTrack = "Now Playing"
        currentArtist = "Demo mode"
        albumArtURL = nil
        isPlaying = false
    }

    func playPause() {
        guard isConnected, !isDemoMode else { return }
        Task { @MainActor in
            if isPlaying {
                let (_, status) = await apiRequest("/me/player/pause", method: "PUT") ?? (nil, 0)
                if status == 204 { isPlaying = false }
                return
            }

            var status = await startPlayback(deviceID: activeDeviceId)
            if status == 204 {
                isPlaying = true
                return
            }

            if activeDeviceId != nil {
                status = await startPlayback(deviceID: nil)
                if status == 204 {
                    isPlaying = true
                    return
                }
            }

            if status == 404, await openSpotifyAndAttemptPlaybackStart() {
                try? await Task.sleep(for: .milliseconds(250))
                await fetchPlaybackState()
            }
        }
    }

    @MainActor
    private func startPlayback(deviceID: String?) async -> Int {
        var path = "/me/player/play"
        if let deviceID,
           let encodedDeviceID = deviceID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "?device_id=\(encodedDeviceID)"
        }
        let (_, status) = await apiRequest(path, method: "PUT") ?? (nil, 0)
        return status
    }

    private func fetchAvailableDeviceID() async -> String? {
        guard let (data, status) = await apiRequest("/me/player/devices"),
              status == 200,
              let data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let devices = json["devices"] as? [[String: Any]] else {
            return nil
        }

        let candidates = devices.filter { device in
            let isRestricted = device["is_restricted"] as? Bool ?? false
            let id = device["id"] as? String
            return !isRestricted && !(id?.isEmpty ?? true)
        }

        if let activeID = candidates.first(where: { ($0["is_active"] as? Bool) == true })?["id"] as? String {
            return activeID
        }
        return candidates.first?["id"] as? String
    }

    @MainActor
    @discardableResult
    private func openSpotifyApp() -> Bool {
        if let spotifyURL = URL(string: "spotify:"), NSWorkspace.shared.open(spotifyURL) {
            return true
        }
        if let webURL = URL(string: "https://open.spotify.com") {
            return NSWorkspace.shared.open(webURL)
        }
        return false
    }

    @MainActor
    private func openSpotifyAndAttemptPlaybackStart() async -> Bool {
        guard openSpotifyApp() else { return false }

        for _ in 0..<3 {
            try? await Task.sleep(for: .seconds(1))
            guard let deviceID = await fetchAvailableDeviceID() else { continue }
            activeDeviceId = deviceID
            let status = await startPlayback(deviceID: deviceID)
            if status == 204 {
                isPlaying = true
                return true
            }
        }

        return false
    }

    func seek(positionMs: Int) {
        guard isConnected, !isDemoMode else { return }
        Task { @MainActor in
            _ = await apiRequest("/me/player/seek?position_ms=\(positionMs)", method: "PUT")
            progressMs = positionMs
            try? await Task.sleep(for: .milliseconds(200))
            await fetchPlaybackState()
        }
    }

    func nextTrack() {
        guard isConnected, !isDemoMode else { return }
        lastLyricsTrackKey = nil
        Task { @MainActor in
            _ = await apiRequest("/me/player/next", method: "POST")
            try? await Task.sleep(for: .milliseconds(300))
            await fetchPlaybackState()
        }
    }

    func previousTrack() {
        guard isConnected, !isDemoMode else { return }
        lastLyricsTrackKey = nil
        Task { @MainActor in
            _ = await apiRequest("/me/player/previous", method: "POST")
            try? await Task.sleep(for: .milliseconds(300))
            await fetchPlaybackState()
        }
    }

    func setShuffle(_ enabled: Bool) {
        guard isConnected, !isDemoMode else { return }
        Task { @MainActor in
            var params = ["state": enabled ? "true" : "false"]
            if let id = activeDeviceId { params["device_id"] = id }
            let path = "/me/player/shuffle" + "?" + params.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
            let (_, status) = await apiRequest(path, method: "PUT") ?? (nil, 0)
            if status == 204 {
                shuffleState = enabled
            } else {
                await fetchPlaybackState()
            }
        }
    }

    func setRepeatMode(_ state: RepeatState) {
        guard isConnected, !isDemoMode else { return }
        Task { @MainActor in
            var params = ["state": state.apiValue]
            if let id = activeDeviceId { params["device_id"] = id }
            let path = "/me/player/repeat" + "?" + params.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
            let (_, status) = await apiRequest(path, method: "PUT") ?? (nil, 0)
            if status == 204 {
                repeatState = state
            } else {
                await fetchPlaybackState()
            }
        }
    }

    private func generateCodeVerifier() -> String {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return (0..<64).compactMap { _ in chars.randomElement().map { String($0) } }.joined()
    }

    private func createCodeChallenge(from verifier: String) -> String? {
        guard let data = verifier.data(using: .utf8) else { return nil }
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private final class SessionContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = SessionContextProvider()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first { $0.isKeyWindow }
            ?? NSApplication.shared.windows.first
            ?? NSWindow()
    }
}
