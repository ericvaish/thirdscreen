//
//  GoogleCalendarService.swift
//  thirdscreen
//

import Foundation
import AppKit
import AuthenticationServices
import CryptoKit

private let googleClientIDKey = "GoogleCalendarClientID"
private let googleRedirectURIKey = "GoogleCalendarRedirectURI"
private let googleAccessTokenKey = "GoogleCalendarAccessToken"
private let googleRefreshTokenKey = "GoogleCalendarRefreshToken"
private let googleTokenExpiryKey = "GoogleCalendarTokenExpiry"
private let googleScope = "https://www.googleapis.com/auth/calendar.events"

enum GoogleCalendarServiceEditError: LocalizedError {
    case notConnected
    case sessionExpired
    case insufficientPermissions
    case eventNotFound
    case requestFailed(Int)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Google Calendar is not connected."
        case .sessionExpired:
            return "Google Calendar session expired. Reconnect and try again."
        case .insufficientPermissions:
            return "Google Calendar permissions are read-only. Disconnect and reconnect to grant edit access."
        case .eventNotFound:
            return "The Google Calendar event could not be found."
        case .requestFailed(let code):
            return "Google Calendar update failed (\(code))."
        }
    }
}

struct GoogleCalendarEvent: Identifiable, Equatable {
    let id: String
    let title: String
    let startDate: Date
    let endDate: Date
    let joinInfo: MeetingJoinInfo?
    let location: String?
    let notes: String?
    let organizer: String?
    let attendees: [String]
    let eventURL: URL?
    let status: String?
    let isAllDay: Bool
}

@Observable
final class GoogleCalendarService {
    private(set) var isConnected = false
    private(set) var isConnecting = false
    private(set) var connectionError: String?
    private(set) var events: [GoogleCalendarEvent] = []
    private var autoRefreshTask: Task<Void, Never>?
    private let autoRefreshIntervalSeconds: TimeInterval = 60

    private var clientID: String {
        ((Bundle.main.object(forInfoDictionaryKey: googleClientIDKey) as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var redirectURI: String {
        let configured = ((Bundle.main.object(forInfoDictionaryKey: googleRedirectURIKey) as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !configured.isEmpty {
            return configured
        }
        // Keep redirect configurable in Info.plist; this default matches the app bundle id.
        return "thirdscreen.thirdscreen:/oauth2redirect/google"
    }

    private var callbackScheme: String {
        URL(string: redirectURI)?.scheme ?? ""
    }

    var isConfigured: Bool {
        !clientID.isEmpty && !callbackScheme.isEmpty
    }

    init() {
        if hasStoredToken() {
            Task { @MainActor in await restoreSession() }
        }
    }

    private func hasStoredToken() -> Bool {
        if KeychainHelper.string(forKey: googleAccessTokenKey, service: KeychainHelper.googleService) != nil { return true }
        if UserDefaults.standard.string(forKey: googleAccessTokenKey) != nil {
            migrateFromUserDefaults()
            return true
        }
        return false
    }

    private func migrateFromUserDefaults() {
        if let access = UserDefaults.standard.string(forKey: googleAccessTokenKey) {
            _ = KeychainHelper.set(access, forKey: googleAccessTokenKey, service: KeychainHelper.googleService)
        }
        if let refresh = UserDefaults.standard.string(forKey: googleRefreshTokenKey) {
            _ = KeychainHelper.set(refresh, forKey: googleRefreshTokenKey, service: KeychainHelper.googleService)
        }
        if let expiry = UserDefaults.standard.object(forKey: googleTokenExpiryKey) as? Date {
            _ = KeychainHelper.set(expiry, forKey: googleTokenExpiryKey, service: KeychainHelper.googleService)
        }
        UserDefaults.standard.removeObject(forKey: googleAccessTokenKey)
        UserDefaults.standard.removeObject(forKey: googleRefreshTokenKey)
        UserDefaults.standard.removeObject(forKey: googleTokenExpiryKey)
    }

    deinit {
        autoRefreshTask?.cancel()
    }

    func connect() {
        guard !clientID.isEmpty else {
            connectionError = "Add GoogleCalendarClientID to Info.plist from your Google Cloud OAuth client."
            return
        }
        guard !callbackScheme.isEmpty else {
            connectionError = "GoogleCalendarRedirectURI is invalid. It must include a URL scheme."
            return
        }
        isConnecting = true
        connectionError = nil
        Task { @MainActor in await performOAuth() }
    }

    func disconnect() {
        let tokenForRevocation = KeychainHelper.string(forKey: googleRefreshTokenKey, service: KeychainHelper.googleService)
            ?? KeychainHelper.string(forKey: googleAccessTokenKey, service: KeychainHelper.googleService)
            ?? UserDefaults.standard.string(forKey: googleRefreshTokenKey)
            ?? UserDefaults.standard.string(forKey: googleAccessTokenKey)
        clearSession()
        if let tokenForRevocation {
            Task {
                await revoke(token: tokenForRevocation)
            }
        }
    }

    func refreshSessionAndEventsIfNeeded() async {
        guard isConnected else { return }
        guard await refreshAccessTokenIfNeeded() else {
            clearSession()
            return
        }
        await fetchEvents()
        startAutoRefresh()
    }

    func fetchEvents() async {
        guard isConnected else { return }
        guard let token = await validAccessToken() else {
            connectionError = "Google Calendar session expired. Reconnect required."
            clearSession()
            return
        }

        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .day, value: 7, to: start) ?? start

        var components = URLComponents(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events")!
        components.queryItems = [
            URLQueryItem(name: "singleEvents", value: "true"),
            URLQueryItem(name: "orderBy", value: "startTime"),
            URLQueryItem(name: "timeMin", value: Self.iso8601DateFormatter.string(from: start)),
            URLQueryItem(name: "timeMax", value: Self.iso8601DateFormatter.string(from: end)),
            URLQueryItem(name: "maxResults", value: "250"),
            URLQueryItem(name: "conferenceDataVersion", value: "1"),
        ]
        guard let url = components.url else { return }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse else {
            connectionError = "Failed to fetch Google Calendar events."
            return
        }

        guard http.statusCode == 200 else {
            if http.statusCode == 401 {
                if await refreshAccessTokenIfNeeded() {
                    await fetchEvents()
                    return
                }
                clearSession()
                connectionError = "Google Calendar authorization expired. Reconnect required."
                return
            }
            connectionError = "Google Calendar request failed (\(http.statusCode))."
            return
        }

        guard let decoded = try? JSONDecoder().decode(GoogleEventsResponse.self, from: data) else {
            connectionError = "Failed to parse Google Calendar response."
            return
        }

        let parsed = decoded.items.compactMap(parseEvent)
            .sorted { $0.startDate < $1.startDate }
        events = parsed
    }

    func updateEvent(
        eventID: String,
        title: String,
        startDate: Date,
        endDate: Date,
        isAllDay: Bool,
        location: String?,
        notes: String?
    ) async throws {
        guard isConnected else {
            throw GoogleCalendarServiceEditError.notConnected
        }
        try await updateEvent(
            eventID: eventID,
            title: title,
            startDate: startDate,
            endDate: endDate,
            isAllDay: isAllDay,
            location: location,
            notes: notes,
            allowRetry: true
        )
        await fetchEvents()
    }

    func events(for date: Date) -> [GoogleCalendarEvent] {
        let cal = Calendar.current
        return events.filter { cal.isDate($0.startDate, inSameDayAs: date) }
    }

    @MainActor
    private func performOAuth() async {
        defer { isConnecting = false }

        let verifier = generateCodeVerifier()
        guard let challenge = createCodeChallenge(from: verifier) else {
            connectionError = "Failed to generate Google OAuth challenge."
            return
        }
        let state = generateCodeVerifier()

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: googleScope),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "include_granted_scopes", value: "true"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]
        guard let authURL = components.url else {
            connectionError = "Failed to build Google authorization URL."
            return
        }

        let callbackURL: URL? = await withCheckedContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                guard error == nil else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.presentationContextProvider = GoogleSessionContextProvider.shared
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        guard let callbackURL else {
            connectionError = "Google authorization was cancelled or failed."
            return
        }

        let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        let callbackState = callbackComponents?.queryItems?.first(where: { $0.name == "state" })?.value
        if callbackState != state {
            connectionError = "Google authorization state mismatch."
            return
        }

        let code = callbackComponents?.queryItems?.first(where: { $0.name == "code" })?.value
        guard let code else {
            let error = callbackComponents?.queryItems?.first(where: { $0.name == "error" })?.value
            connectionError = error.map { "Google error: \($0)" } ?? "Failed to get Google authorization code."
            return
        }

        guard await exchangeCodeForTokens(code: code, verifier: verifier) else { return }
        isConnected = true
        await fetchEvents()
        startAutoRefresh()
    }

    @MainActor
    private func restoreSession() async {
        guard await refreshAccessTokenIfNeeded() else {
            clearSession()
            return
        }
        isConnected = true
        await fetchEvents()
        startAutoRefresh()
    }

    private func validAccessToken() async -> String? {
        guard await refreshAccessTokenIfNeeded() else { return nil }
        return KeychainHelper.string(forKey: googleAccessTokenKey, service: KeychainHelper.googleService)
            ?? UserDefaults.standard.string(forKey: googleAccessTokenKey)
    }

    private func exchangeCodeForTokens(code: String, verifier: String) async -> Bool {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = [
            "code": code,
            "client_id": clientID,
            "redirect_uri": redirectURI,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        ]
        .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
        .joined(separator: "&")
        .data(using: .utf8)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let payload = try? JSONDecoder().decode(GoogleTokenResponse.self, from: data) else {
            connectionError = "Failed to get Google access token."
            return false
        }

        storeTokenResponse(payload)
        return true
    }

    private func refreshAccessTokenIfNeeded() async -> Bool {
        let expiry = KeychainHelper.date(forKey: googleTokenExpiryKey, service: KeychainHelper.googleService)
            ?? UserDefaults.standard.object(forKey: googleTokenExpiryKey) as? Date
        if let expiry, expiry.timeIntervalSinceNow > 60,
           (KeychainHelper.string(forKey: googleAccessTokenKey, service: KeychainHelper.googleService) ?? UserDefaults.standard.string(forKey: googleAccessTokenKey)) != nil {
            return true
        }

        guard let refreshToken = KeychainHelper.string(forKey: googleRefreshTokenKey, service: KeychainHelper.googleService)
            ?? UserDefaults.standard.string(forKey: googleRefreshTokenKey) else {
            return false
        }

        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = [
            "client_id": clientID,
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
        ]
        .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
        .joined(separator: "&")
        .data(using: .utf8)

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let payload = try? JSONDecoder().decode(GoogleTokenResponse.self, from: data) else {
            return false
        }

        storeTokenResponse(payload)
        return true
    }

    private func storeTokenResponse(_ payload: GoogleTokenResponse) {
        _ = KeychainHelper.set(payload.accessToken, forKey: googleAccessTokenKey, service: KeychainHelper.googleService)
        _ = KeychainHelper.set(Date().addingTimeInterval(TimeInterval(payload.expiresIn)), forKey: googleTokenExpiryKey, service: KeychainHelper.googleService)
        if let refreshToken = payload.refreshToken, !refreshToken.isEmpty {
            _ = KeychainHelper.set(refreshToken, forKey: googleRefreshTokenKey, service: KeychainHelper.googleService)
        }
    }

    private func clearStoredTokens() {
        KeychainHelper.delete(keys: [googleAccessTokenKey, googleRefreshTokenKey, googleTokenExpiryKey], service: KeychainHelper.googleService)
        UserDefaults.standard.removeObject(forKey: googleAccessTokenKey)
        UserDefaults.standard.removeObject(forKey: googleRefreshTokenKey)
        UserDefaults.standard.removeObject(forKey: googleTokenExpiryKey)
    }

    private func clearSession() {
        isConnected = false
        isConnecting = false
        events = []
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
        clearStoredTokens()
    }

    private func startAutoRefresh() {
        autoRefreshTask?.cancel()
        autoRefreshTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(autoRefreshIntervalSeconds))
                if Task.isCancelled { break }
                guard isConnected else { continue }
                await fetchEvents()
            }
        }
    }

    private func revoke(token: String) async {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/revoke")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = "token=\(token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token)"
            .data(using: .utf8)
        _ = try? await URLSession.shared.data(for: request)
    }

    private func parseEvent(_ raw: GoogleEventPayload) -> GoogleCalendarEvent? {
        guard let start = parseDate(from: raw.start) else { return nil }
        var end = parseDate(from: raw.end) ?? start.addingTimeInterval(30 * 60)
        if end <= start {
            end = start.addingTimeInterval(30 * 60)
        }
        let attendees = (raw.attendees ?? []).compactMap { attendee in
            let display = attendee.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !display.isEmpty { return display }
            let email = attendee.email?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return email.isEmpty ? nil : email
        }
        let organizerDisplay = raw.organizer?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let organizerEmail = raw.organizer?.email?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let organizer = !organizerDisplay.isEmpty ? organizerDisplay : (organizerEmail.isEmpty ? nil : organizerEmail)

        return GoogleCalendarEvent(
            id: raw.id,
            title: (raw.summary?.isEmpty == false ? raw.summary : nil) ?? "Untitled",
            startDate: start,
            endDate: end,
            joinInfo: MeetingLinkExtractor.extractFromGoogle(
                hangoutLink: raw.hangoutLink,
                conferenceEntryURIs: raw.conferenceData?.entryPoints?.compactMap(\.uri) ?? [],
                location: raw.location,
                description: raw.description
            ),
            location: raw.location,
            notes: raw.description,
            organizer: organizer,
            attendees: attendees,
            eventURL: raw.htmlLink.flatMap(URL.init(string:)),
            status: raw.status,
            isAllDay: raw.start.date != nil
        )
    }

    private func parseDate(from payload: GoogleEventDatePayload) -> Date? {
        if let dateTime = payload.dateTime {
            if let parsed = Self.iso8601DateTimeFormatter.date(from: dateTime) {
                return parsed
            }
            if let parsed = Self.iso8601DateTimeNoFractionalFormatter.date(from: dateTime) {
                return parsed
            }
        }
        if let allDay = payload.date {
            return parseAllDayDate(allDay)
        }
        return nil
    }

    private func parseAllDayDate(_ raw: String) -> Date? {
        let parts = raw.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var comps = DateComponents()
        comps.year = parts[0]
        comps.month = parts[1]
        comps.day = parts[2]
        comps.calendar = Calendar.current
        comps.timeZone = TimeZone.current
        return comps.date
    }

    private func generateCodeVerifier() -> String {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
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

    private static let iso8601DateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let googleDateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let iso8601DateTimeFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso8601DateTimeNoFractionalFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func updateEvent(
        eventID: String,
        title: String,
        startDate: Date,
        endDate: Date,
        isAllDay: Bool,
        location: String?,
        notes: String?,
        allowRetry: Bool
    ) async throws {
        guard let token = await validAccessToken() else {
            clearSession()
            throw GoogleCalendarServiceEditError.sessionExpired
        }

        var components = URLComponents(
            string: "https://www.googleapis.com/calendar/v3/calendars/primary/events/\(eventID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? eventID)"
        )!
        components.queryItems = [
            URLQueryItem(name: "conferenceDataVersion", value: "1"),
        ]
        guard let url = components.url else {
            throw GoogleCalendarServiceEditError.requestFailed(-1)
        }

        let body = GoogleEventUpdatePayload(
            summary: title,
            location: location?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            description: notes?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            start: updateDatePayload(date: startDate, isAllDay: isAllDay),
            end: updateDatePayload(date: endDate, isAllDay: isAllDay)
        )

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        guard let (_, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse else {
            throw GoogleCalendarServiceEditError.requestFailed(-1)
        }

        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401, allowRetry, await refreshAccessTokenIfNeeded() {
                try await updateEvent(
                    eventID: eventID,
                    title: title,
                    startDate: startDate,
                    endDate: endDate,
                    isAllDay: isAllDay,
                    location: location,
                    notes: notes,
                    allowRetry: false
                )
                return
            }
            if http.statusCode == 403 {
                connectionError = "Google Calendar needs edit permission. Disconnect and reconnect."
                throw GoogleCalendarServiceEditError.insufficientPermissions
            }
            if http.statusCode == 404 {
                throw GoogleCalendarServiceEditError.eventNotFound
            }
            throw GoogleCalendarServiceEditError.requestFailed(http.statusCode)
        }
    }

    private func updateDatePayload(date: Date, isAllDay: Bool) -> GoogleEventUpdateDatePayload {
        if isAllDay {
            return GoogleEventUpdateDatePayload(
                dateTime: nil,
                date: Self.googleDateOnlyFormatter.string(from: date),
                timeZone: nil
            )
        }
        return GoogleEventUpdateDatePayload(
            dateTime: Self.iso8601DateFormatter.string(from: date),
            date: nil,
            timeZone: TimeZone.current.identifier
        )
    }
}

private struct GoogleTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

private struct GoogleEventsResponse: Decodable {
    let items: [GoogleEventPayload]
}

private struct GoogleEventPayload: Decodable {
    let id: String
    let summary: String?
    let description: String?
    let location: String?
    let hangoutLink: String?
    let htmlLink: String?
    let status: String?
    let organizer: GoogleIdentityPayload?
    let attendees: [GoogleIdentityPayload]?
    let conferenceData: GoogleConferenceDataPayload?
    let start: GoogleEventDatePayload
    let end: GoogleEventDatePayload
}

private struct GoogleIdentityPayload: Decodable {
    let email: String?
    let displayName: String?
}

private struct GoogleConferenceDataPayload: Decodable {
    let entryPoints: [GoogleConferenceEntryPointPayload]?
}

private struct GoogleConferenceEntryPointPayload: Decodable {
    let uri: String?
}

private struct GoogleEventDatePayload: Decodable {
    let dateTime: String?
    let date: String?

    enum CodingKeys: String, CodingKey {
        case dateTime
        case date
    }
}

private struct GoogleEventUpdatePayload: Encodable {
    let summary: String
    let location: String?
    let description: String?
    let start: GoogleEventUpdateDatePayload
    let end: GoogleEventUpdateDatePayload
}

private struct GoogleEventUpdateDatePayload: Encodable {
    let dateTime: String?
    let date: String?
    let timeZone: String?
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

private final class GoogleSessionContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GoogleSessionContextProvider()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first { $0.isKeyWindow }
            ?? NSApplication.shared.windows.first
            ?? NSWindow()
    }
}
