import Foundation

enum TimeCardPreferenceKey {
    static let clockPresentation = "timeCardClockPresentation"
    static let digitalStyle = "timeCardDigitalClockStyle"
    static let analogStyle = "timeCardAnalogClockStyle"
    static let showSeconds = "timeCardShowSeconds"
    static let use24Hour = "timeCardUse24Hour"
    static let selectedTimeZoneID = "timeCardPrimaryTimeZoneID"
    static let worldTimeZoneIDs = "timeCardWorldTimeZoneIDs"
}

enum TimeCardClockPresentation: String, CaseIterable, Identifiable {
    case digital = "Digital"
    case analog = "Analog"
    case world = "World"

    var id: String { rawValue }
}

enum TimeCardDigitalClockStyle: String, CaseIterable, Identifiable {
    case stacked = "Stacked Mono"
    case splitFlap = "Split Flap"
    case board = "Status Board"
    case capsules = "Capsules"
    case calendar = "Calendar Stack"
    case binary = "Binary Matrix"

    var id: String { rawValue }
}

enum TimeCardAnalogClockStyle: String, CaseIterable, Identifiable {
    case railway = "Railway"
    case minimal = "Minimal Rings"
    case chronograph = "Chronograph"

    var id: String { rawValue }
}

enum TimeCardPreferences {
    static let defaultWorldTimeZoneIDs: [String] = [
        "America/Los_Angeles",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo"
    ]

    static let defaultWorldTimeZoneIDsStorage: String = defaultWorldTimeZoneIDs.joined(separator: "|")

    private static let preferredTimeZoneIDs: [String] = [
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "America/Phoenix",
        "America/Anchorage",
        "Pacific/Honolulu",
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Asia/Dubai",
        "Asia/Kolkata",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney"
    ]

    static func normalizePrimaryTimeZoneID(_ zoneID: String) -> String {
        if TimeZone(identifier: zoneID) != nil {
            return zoneID
        }
        return TimeZone.current.identifier
    }

    static func decodeWorldTimeZoneIDs(_ rawValue: String) -> [String] {
        let parsed = rawValue
            .split(separator: "|")
            .map(String.init)
            .filter { TimeZone(identifier: $0) != nil }
        let unique = uniqueZoneIDs(parsed)
        if unique.isEmpty {
            return defaultWorldTimeZoneIDs
        }
        return unique
    }

    static func encodeWorldTimeZoneIDs(_ zoneIDs: [String]) -> String {
        uniqueZoneIDs(zoneIDs).joined(separator: "|")
    }

    static func normalizedWorldTimeZoneIDs(_ zoneIDs: [String], primaryZoneID: String) -> [String] {
        let primary = normalizePrimaryTimeZoneID(primaryZoneID)
        var normalized = uniqueZoneIDs(zoneIDs)
        if normalized.isEmpty {
            normalized = defaultWorldTimeZoneIDs
        }
        if !normalized.contains(primary) {
            normalized.insert(primary, at: 0)
        }
        return normalized
    }

    static func availableTimeZoneIDs(primaryZoneID: String, worldTimeZoneIDs: [String]) -> [String] {
        var ids = Set(preferredTimeZoneIDs)
        ids.insert(TimeZone.current.identifier)
        ids.insert(normalizePrimaryTimeZoneID(primaryZoneID))
        ids.formUnion(worldTimeZoneIDs)
        return ids.sorted()
    }

    static func timeZoneDisplayName(_ zoneID: String) -> String {
        let zone = TimeZone(identifier: zoneID)
        let city = zoneID.split(separator: "/").last?.replacingOccurrences(of: "_", with: " ") ?? zoneID
        let short = zone?.abbreviation(for: Date()) ?? "TZ"
        return "\(city) (\(short))"
    }

    private static func uniqueZoneIDs(_ zoneIDs: [String]) -> [String] {
        var seen = Set<String>()
        return zoneIDs.filter { zoneID in
            guard TimeZone(identifier: zoneID) != nil else { return false }
            return seen.insert(zoneID).inserted
        }
    }
}
