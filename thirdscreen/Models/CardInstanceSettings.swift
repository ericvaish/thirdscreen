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
    var modeRaw: String
    var clockPresentationRaw: String
    var digitalStyleRaw: String
    var analogStyleRaw: String
    var showSeconds: Bool
    var use24Hour: Bool
    var selectedTimeZoneID: String
    var worldTimeZoneIDsRaw: String

    static var `default`: TimeCardConfig {
        TimeCardConfig(
            modeRaw: TimeCardMode.clock.rawValue,
            clockPresentationRaw: TimeCardClockPresentation.digital.rawValue,
            digitalStyleRaw: TimeCardDigitalClockStyle.stacked.rawValue,
            analogStyleRaw: TimeCardAnalogClockStyle.railway.rawValue,
            showSeconds: true,
            use24Hour: false,
            selectedTimeZoneID: TimeZone.current.identifier,
            worldTimeZoneIDsRaw: TimeCardPreferences.defaultWorldTimeZoneIDsStorage
        )
    }

    init(modeRaw: String, clockPresentationRaw: String, digitalStyleRaw: String, analogStyleRaw: String, showSeconds: Bool, use24Hour: Bool, selectedTimeZoneID: String, worldTimeZoneIDsRaw: String) {
        self.modeRaw = modeRaw
        self.clockPresentationRaw = clockPresentationRaw
        self.digitalStyleRaw = digitalStyleRaw
        self.analogStyleRaw = analogStyleRaw
        self.showSeconds = showSeconds
        self.use24Hour = use24Hour
        self.selectedTimeZoneID = selectedTimeZoneID
        self.worldTimeZoneIDsRaw = worldTimeZoneIDsRaw
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        modeRaw = try container.decodeIfPresent(String.self, forKey: .modeRaw) ?? TimeCardMode.clock.rawValue
        clockPresentationRaw = try container.decode(String.self, forKey: .clockPresentationRaw)
        digitalStyleRaw = try container.decode(String.self, forKey: .digitalStyleRaw)
        analogStyleRaw = try container.decode(String.self, forKey: .analogStyleRaw)
        showSeconds = try container.decode(Bool.self, forKey: .showSeconds)
        use24Hour = try container.decode(Bool.self, forKey: .use24Hour)
        selectedTimeZoneID = try container.decode(String.self, forKey: .selectedTimeZoneID)
        worldTimeZoneIDsRaw = try container.decode(String.self, forKey: .worldTimeZoneIDsRaw)
    }

    var mode: TimeCardMode {
        get { TimeCardMode(rawValue: modeRaw) ?? .clock }
        set { modeRaw = newValue.rawValue }
    }

    private enum CodingKeys: String, CodingKey {
        case modeRaw
        case clockPresentationRaw
        case digitalStyleRaw
        case analogStyleRaw
        case showSeconds
        case use24Hour
        case selectedTimeZoneID
        case worldTimeZoneIDsRaw
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(modeRaw, forKey: .modeRaw)
        try container.encode(clockPresentationRaw, forKey: .clockPresentationRaw)
        try container.encode(digitalStyleRaw, forKey: .digitalStyleRaw)
        try container.encode(analogStyleRaw, forKey: .analogStyleRaw)
        try container.encode(showSeconds, forKey: .showSeconds)
        try container.encode(use24Hour, forKey: .use24Hour)
        try container.encode(selectedTimeZoneID, forKey: .selectedTimeZoneID)
        try container.encode(worldTimeZoneIDsRaw, forKey: .worldTimeZoneIDsRaw)
    }
}

struct MediaCardConfig: Codable, Equatable {
    var provider: MediaProvider
    var showLyrics: Bool

    static var `default`: MediaCardConfig {
        MediaCardConfig(provider: .spotify, showLyrics: true)
    }
}

struct AIChatCardConfig: Codable, Equatable {
    var selectedModelID: String
    var systemPrompt: String

    static var `default`: AIChatCardConfig {
        AIChatCardConfig(
            selectedModelID: "apple-foundation",
            systemPrompt: "You are a helpful, concise assistant. You have access to tools — only use them when the user's request clearly requires one. For general conversation, respond directly without using any tools."
        )
    }
}

struct CardInstanceSettingsStore: Codable, Equatable {
    private var timeByID: [String: TimeCardConfig]
    private var mediaByID: [String: MediaCardConfig]
    private var aiChatByID: [String: AIChatCardConfig]

    init(
        timeByID: [String: TimeCardConfig] = [:],
        mediaByID: [String: MediaCardConfig] = [:],
        aiChatByID: [String: AIChatCardConfig] = [:]
    ) {
        self.timeByID = timeByID
        self.mediaByID = mediaByID
        self.aiChatByID = aiChatByID
    }

    static var empty: CardInstanceSettingsStore { CardInstanceSettingsStore() }

    func timeConfig(for instanceID: UUID) -> TimeCardConfig? {
        timeByID[instanceID.uuidString]
    }

    func mediaConfig(for instanceID: UUID) -> MediaCardConfig? {
        mediaByID[instanceID.uuidString]
    }

    func aiChatConfig(for instanceID: UUID) -> AIChatCardConfig? {
        aiChatByID[instanceID.uuidString]
    }

    mutating func setTimeConfig(_ config: TimeCardConfig, for instanceID: UUID) {
        timeByID[instanceID.uuidString] = config
    }

    mutating func setMediaConfig(_ config: MediaCardConfig, for instanceID: UUID) {
        mediaByID[instanceID.uuidString] = config
    }

    mutating func setAIChatConfig(_ config: AIChatCardConfig, for instanceID: UUID) {
        aiChatByID[instanceID.uuidString] = config
    }

    mutating func removeAllSettings(for instanceID: UUID) {
        timeByID.removeValue(forKey: instanceID.uuidString)
        mediaByID.removeValue(forKey: instanceID.uuidString)
        aiChatByID.removeValue(forKey: instanceID.uuidString)
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
            case .schedule, .battery, .calendar, .todos, .notes, .icloudNotes, .localNotes, .medicines, .aiChat, .calories:
                continue
            }
        }
    }

    mutating func ensureRuntimeDefaults(for cards: [CardPlacement]) {
        let aliveIDs = Set(cards.map(\.instanceID.uuidString))
        timeByID = timeByID.filter { aliveIDs.contains($0.key) }
        mediaByID = mediaByID.filter { aliveIDs.contains($0.key) }
        aiChatByID = aiChatByID.filter { aliveIDs.contains($0.key) }

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
            case .aiChat:
                if aiChatByID[card.instanceID.uuidString] == nil {
                    aiChatByID[card.instanceID.uuidString] = .default
                }
            case .schedule, .battery, .calendar, .todos, .notes, .icloudNotes, .localNotes, .medicines, .calories:
                continue
            }
        }
    }
}
