//
//  MeetingLinkExtractor.swift
//  thirdscreen
//

import Foundation

enum MeetingLinkExtractor {
    static func extractFromApple(
        eventURL: URL?,
        notes: String?,
        location: String?
    ) -> MeetingJoinInfo? {
        var candidates: [URL] = []
        if let eventURL {
            candidates.append(eventURL)
        }
        candidates.append(contentsOf: urls(in: notes))
        candidates.append(contentsOf: urls(in: location))
        return bestJoinInfo(from: candidates)
    }

    static func extractFromGoogle(
        hangoutLink: String?,
        conferenceEntryURIs: [String],
        location: String?,
        description: String?
    ) -> MeetingJoinInfo? {
        var candidates: [URL] = []
        for entry in conferenceEntryURIs {
            candidates.append(contentsOf: urls(in: entry))
        }
        candidates.append(contentsOf: urls(in: hangoutLink))
        candidates.append(contentsOf: urls(in: location))
        candidates.append(contentsOf: urls(in: description))
        return bestJoinInfo(from: candidates)
    }

    static func normalizedURLKey(for url: URL) -> String? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased() else {
            return nil
        }

        let normalizedScheme = scheme
        let normalizedHost = components.host?.lowercased()
        let normalizedPath = components.path.isEmpty ? "" : components.path
        let normalizedPort = components.port

        components.fragment = nil

        let filteredItems = (components.queryItems ?? [])
            .filter { !isTrackingParam($0.name) }
            .sorted { lhs, rhs in
                if lhs.name == rhs.name {
                    return (lhs.value ?? "") < (rhs.value ?? "")
                }
                return lhs.name < rhs.name
            }

        let queryString = filteredItems.isEmpty
            ? nil
            : filteredItems
            .map { item in
                if let value = item.value {
                    return "\(item.name)=\(value)"
                }
                return item.name
            }
            .joined(separator: "&")

        var key = "\(normalizedScheme)://"
        if let normalizedHost {
            key += normalizedHost
        } else if let hostLike = components.path.split(separator: "/").first {
            key += hostLike.lowercased()
        }
        if let normalizedPort {
            key += ":\(normalizedPort)"
        }
        key += normalizedPath
        if let queryString, !queryString.isEmpty {
            key += "?\(queryString)"
        }
        return key
    }

    private static func bestJoinInfo(from urls: [URL]) -> MeetingJoinInfo? {
        var bestSpecific: MeetingJoinInfo?
        var bestGeneric: MeetingJoinInfo?

        for url in urls {
            guard isAllowed(url: url),
                  let normalizedKey = normalizedURLKey(for: url) else { continue }
            let provider = provider(for: url)
            let info = MeetingJoinInfo(url: url, provider: provider, normalizedKey: normalizedKey)

            if provider == .generic {
                if bestGeneric == nil {
                    bestGeneric = info
                }
            } else if bestSpecific == nil {
                bestSpecific = info
            }
        }

        return bestSpecific ?? bestGeneric
    }

    private static func isTrackingParam(_ name: String) -> Bool {
        let lowered = name.lowercased()
        if lowered.hasPrefix("utm_") {
            return true
        }
        return [
            "gclid",
            "fbclid",
            "mc_cid",
            "mc_eid",
            "_hsenc",
            "_hsmi",
        ].contains(lowered)
    }

    private static func provider(for url: URL) -> MeetingProvider {
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "zoommtg" {
            return .zoom
        }

        let host = url.host?.lowercased() ?? ""
        if host == "meet.google.com" || host.hasSuffix(".meet.google.com") || host == "g.co" {
            return .googleMeet
        }
        if host == "zoom.us" || host.hasSuffix(".zoom.us") {
            return .zoom
        }
        return .generic
    }

    private static func isAllowed(url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        if scheme == "zoommtg" {
            return true
        }
        return scheme == "https"
    }

    private static func urls(in raw: String?) -> [URL] {
        guard let raw, !raw.isEmpty else { return [] }

        var urls: [URL] = []
        if let direct = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
           direct.scheme != nil {
            urls.append(direct)
        }

        let fullRange = NSRange(raw.startIndex..<raw.endIndex, in: raw)
        if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) {
            detector.enumerateMatches(in: raw, options: [], range: fullRange) { match, _, _ in
                guard let url = match?.url else { return }
                urls.append(url)
            }
        }
        return urls
    }
}
