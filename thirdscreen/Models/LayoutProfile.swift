import Foundation

struct LayoutRatioRange: Codable, Equatable {
    var min: Double
    var max: Double

    init(min: Double, max: Double) {
        self.min = Swift.min(min, max)
        self.max = Swift.max(min, max)
    }

    func contains(_ ratio: Double) -> Bool {
        ratio >= min && ratio <= max
    }
}

struct LayoutProfile: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
    var ratioRange: LayoutRatioRange?
    var layout: DashboardLayoutV2
    var pinned: Bool
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        ratioRange: LayoutRatioRange? = nil,
        layout: DashboardLayoutV2,
        pinned: Bool = false,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.ratioRange = ratioRange
        self.layout = layout
        self.pinned = pinned
        self.updatedAt = updatedAt
    }
}

struct LayoutWorkspace: Codable, Equatable {
    var currentProfileID: UUID?
    var profiles: [LayoutProfile]
    var history: [DashboardLayoutV2]
    var future: [DashboardLayoutV2]
    var autoSaveEnabled: Bool
    var lastStableLayout: DashboardLayoutV2?

    init(
        currentProfileID: UUID? = nil,
        profiles: [LayoutProfile] = [],
        history: [DashboardLayoutV2] = [],
        future: [DashboardLayoutV2] = [],
        autoSaveEnabled: Bool = true,
        lastStableLayout: DashboardLayoutV2? = nil
    ) {
        self.currentProfileID = currentProfileID
        self.profiles = profiles
        self.history = history
        self.future = future
        self.autoSaveEnabled = autoSaveEnabled
        self.lastStableLayout = lastStableLayout
    }

    static func `default`(from baseLayout: DashboardLayoutV2) -> LayoutWorkspace {
        let standard = LayoutProfile(name: "Standard", ratioRange: LayoutRatioRange(min: 1.25, max: 1.9), layout: baseLayout, pinned: true)
        let square = LayoutProfile(name: "Square", ratioRange: LayoutRatioRange(min: 0.8, max: 1.24), layout: DashboardLayoutV2.fromLegacy(LayoutPreset.balanced.layout), pinned: true)
        let ultrawide = LayoutProfile(name: "Ultrawide", ratioRange: LayoutRatioRange(min: 1.9, max: 3.5), layout: DashboardLayoutV2.fromLegacy(LayoutPreset.focusSchedule.layout), pinned: true)
        return LayoutWorkspace(
            currentProfileID: standard.id,
            profiles: [standard, square, ultrawide],
            history: [],
            future: [],
            autoSaveEnabled: true,
            lastStableLayout: baseLayout
        )
    }

    var canUndo: Bool { !history.isEmpty }
    var canRedo: Bool { !future.isEmpty }

    mutating func pushHistory(_ layout: DashboardLayoutV2, limit: Int = 60) {
        history.append(layout)
        if history.count > limit {
            history.removeFirst(history.count - limit)
        }
        future.removeAll()
    }
}
