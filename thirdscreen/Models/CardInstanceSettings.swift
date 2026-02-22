import Foundation

enum MediaProvider: String, Codable, CaseIterable, Identifiable {
    case spotify
    case appleMusic

    var id: String { rawValue }

    var title: String {
        switch self {
        case .spotify: return "Spotify"
        case .appleMusic: return "Apple Music"
        }
    }
}

struct TimeCardConfig: Codable, Equatable {
    var clockPresentationRaw: String
    var digitalStyleRaw: String
    var analogStyleRaw: String
    var showSeconds: Bool
    var use24Hour: Bool
    var selectedTimeZoneID: String
    var worldTimeZoneIDsRaw: String

    static var `default`: TimeCardConfig {
        TimeCardConfig(
            clockPresentationRaw: TimeCardClockPresentation.digital.rawValue,
            digitalStyleRaw: TimeCardDigitalClockStyle.stacked.rawValue,
            analogStyleRaw: TimeCardAnalogClockStyle.railway.rawValue,
            showSeconds: true,
            use24Hour: false,
            selectedTimeZoneID: TimeZone.current.identifier,
            worldTimeZoneIDsRaw: TimeCardPreferences.defaultWorldTimeZoneIDsStorage
        )
    }
}

struct MediaCardConfig: Codable, Equatable {
    var provider: MediaProvider
    var showLyrics: Bool

    static var `default`: MediaCardConfig {
        MediaCardConfig(provider: .spotify, showLyrics: true)
    }
}

struct CardInstanceSettingsStore: Codable, Equatable {
    private var timeByID: [String: TimeCardConfig]
    private var mediaByID: [String: MediaCardConfig]

    init(
        timeByID: [String: TimeCardConfig] = [:],
        mediaByID: [String: MediaCardConfig] = [:]
    ) {
        self.timeByID = timeByID
        self.mediaByID = mediaByID
    }

    static var empty: CardInstanceSettingsStore { CardInstanceSettingsStore() }

    func timeConfig(for instanceID: UUID) -> TimeCardConfig? {
        timeByID[instanceID.uuidString]
    }

    func mediaConfig(for instanceID: UUID) -> MediaCardConfig? {
        mediaByID[instanceID.uuidString]
    }

    mutating func setTimeConfig(_ config: TimeCardConfig, for instanceID: UUID) {
        timeByID[instanceID.uuidString] = config
    }

    mutating func setMediaConfig(_ config: MediaCardConfig, for instanceID: UUID) {
        mediaByID[instanceID.uuidString] = config
    }

    mutating func removeAllSettings(for instanceID: UUID) {
        timeByID.removeValue(forKey: instanceID.uuidString)
        mediaByID.removeValue(forKey: instanceID.uuidString)
    }

    mutating func seedMissingFromLegacy(
        for cards: [CardPlacement],
        legacyTime: TimeCardConfig,
        legacyMediaShowLyrics: Bool
    ) {
        let aliveIDs = Set(cards.map(\.instanceID.uuidString))
        timeByID = timeByID.filter { aliveIDs.contains($0.key) }
        mediaByID = mediaByID.filter { aliveIDs.contains($0.key) }

        for card in cards {
            switch card.kind {
            case .timer:
                if timeByID[card.instanceID.uuidString] == nil {
                    timeByID[card.instanceID.uuidString] = legacyTime
                }
            case .media:
                if mediaByID[card.instanceID.uuidString] == nil {
                    mediaByID[card.instanceID.uuidString] = MediaCardConfig(provider: .spotify, showLyrics: legacyMediaShowLyrics)
                }
            default:
                continue
            }
        }
    }

    mutating func ensureRuntimeDefaults(for cards: [CardPlacement]) {
        let aliveIDs = Set(cards.map(\.instanceID.uuidString))
        timeByID = timeByID.filter { aliveIDs.contains($0.key) }
        mediaByID = mediaByID.filter { aliveIDs.contains($0.key) }

        for card in cards {
            switch card.kind {
            case .timer:
                if timeByID[card.instanceID.uuidString] == nil {
                    timeByID[card.instanceID.uuidString] = .default
                }
            case .media:
                if mediaByID[card.instanceID.uuidString] == nil {
                    mediaByID[card.instanceID.uuidString] = .default
                }
            default:
                continue
            }
        }
    }
}
