import Foundation
import CoreGraphics

enum CompactMode: String, Codable {
    case none
    case vertical
}

struct CardLayoutPolicy {
    let minW: Int
    let minH: Int
    let maxW: Int
    let maxH: Int

    static func policy(for section: DashboardSection) -> CardLayoutPolicy {
        switch section {
        case .timer:
            // Timer has the tallest minimum content footprint due to segmented controls + large clock.
            return CardLayoutPolicy(minW: 8, minH: 5, maxW: 24, maxH: 24)
        case .media:
            return CardLayoutPolicy(minW: 6, minH: 4, maxW: 24, maxH: 24)
        case .schedule:
            return CardLayoutPolicy(minW: 10, minH: 6, maxW: 24, maxH: 28)
        case .calendar:
            return CardLayoutPolicy(minW: 6, minH: 4, maxW: 24, maxH: 24)
        case .todos:
            return CardLayoutPolicy(minW: 8, minH: 4, maxW: 24, maxH: 24)
        case .battery:
            return CardLayoutPolicy(minW: 6, minH: 4, maxW: 24, maxH: 24)
        }
    }

    func normalize(_ card: CardPlacement, columns: Int) -> CardPlacement {
        var next = card
        next.minW = min(max(1, minW), max(1, columns))
        next.minH = max(1, minH)
        next.maxW = min(max(next.minW, maxW), max(1, columns))
        next.maxH = max(next.minH, maxH)
        return next.clamped(columns: columns)
    }
}

struct GridRect: Equatable, Hashable, Codable {
    var x: Int
    var y: Int
    var w: Int
    var h: Int

    var maxX: Int { x + w }
    var maxY: Int { y + h }

    func intersects(_ other: GridRect) -> Bool {
        !(maxX <= other.x || other.maxX <= x || maxY <= other.y || other.maxY <= y)
    }
}

struct CardPlacement: Codable, Equatable, Identifiable {
    var instanceID: UUID
    var kind: DashboardSection
    var title: String?
    var isHidden: Bool

    var x: Int
    var y: Int
    var w: Int
    var h: Int
    var minW: Int
    var minH: Int
    var maxW: Int
    var maxH: Int
    var isLocked: Bool
    var aspectLock: Double?

    var id: UUID { instanceID }

    var trimmedTitle: String? {
        guard let title else { return nil }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    init(
        instanceID: UUID = UUID(),
        kind: DashboardSection,
        title: String? = nil,
        isHidden: Bool = false,
        x: Int,
        y: Int,
        w: Int,
        h: Int,
        minW: Int = 4,
        minH: Int = 4,
        maxW: Int = 24,
        maxH: Int = 20,
        isLocked: Bool = false,
        aspectLock: Double? = nil
    ) {
        self.instanceID = instanceID
        self.kind = kind
        self.title = title
        self.isHidden = isHidden

        self.x = x
        self.y = max(0, y)
        self.w = max(1, w)
        self.h = max(1, h)
        self.minW = max(1, minW)
        self.minH = max(1, minH)
        self.maxW = max(self.minW, maxW)
        self.maxH = max(self.minH, maxH)
        self.isLocked = isLocked
        self.aspectLock = aspectLock
    }

    // Backward-compatible convenience initializer with previous argument label.
    init(
        id: DashboardSection,
        x: Int,
        y: Int,
        w: Int,
        h: Int,
        minW: Int = 4,
        minH: Int = 4,
        maxW: Int = 24,
        maxH: Int = 20,
        isLocked: Bool = false,
        aspectLock: Double? = nil
    ) {
        self.init(
            kind: id,
            x: x,
            y: y,
            w: w,
            h: h,
            minW: minW,
            minH: minH,
            maxW: maxW,
            maxH: maxH,
            isLocked: isLocked,
            aspectLock: aspectLock
        )
    }

    var rect: GridRect {
        get { GridRect(x: x, y: y, w: w, h: h) }
        set {
            x = newValue.x
            y = newValue.y
            w = newValue.w
            h = newValue.h
        }
    }

    func clamped(columns: Int) -> CardPlacement {
        var next = self
        let safeColumns = max(1, columns)

        next.minW = min(max(1, next.minW), safeColumns)
        next.maxW = min(max(next.minW, next.maxW), safeColumns)
        next.w = min(max(next.w, next.minW), next.maxW)

        next.minH = max(1, next.minH)
        next.maxH = max(next.minH, next.maxH)
        next.h = min(max(next.h, next.minH), next.maxH)

        next.x = min(max(0, next.x), max(0, safeColumns - next.w))
        next.y = max(0, next.y)
        return next
    }

    func applyingAspectLockIfNeeded() -> CardPlacement {
        guard let ratio = aspectLock, ratio > 0 else { return self }
        var next = self
        let inferredHeight = Int(round(Double(next.w) / ratio))
        next.h = max(next.minH, min(next.maxH, inferredHeight))
        return next
    }

    private enum CodingKeys: String, CodingKey {
        case instanceID
        case kind
        case title
        case isHidden
        case x
        case y
        case w
        case h
        case minW
        case minH
        case maxW
        case maxH
        case isLocked
        case aspectLock

        // Legacy key from v2 schema.
        case id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decodeIfPresent(DashboardSection.self, forKey: .kind)
            ?? container.decode(DashboardSection.self, forKey: .id)

        self.instanceID = try container.decodeIfPresent(UUID.self, forKey: .instanceID) ?? UUID()
        self.kind = kind
        self.title = try container.decodeIfPresent(String.self, forKey: .title)
        self.isHidden = try container.decodeIfPresent(Bool.self, forKey: .isHidden) ?? false

        self.x = try container.decode(Int.self, forKey: .x)
        self.y = try container.decode(Int.self, forKey: .y)
        self.w = try container.decode(Int.self, forKey: .w)
        self.h = try container.decode(Int.self, forKey: .h)
        self.minW = try container.decode(Int.self, forKey: .minW)
        self.minH = try container.decode(Int.self, forKey: .minH)
        self.maxW = try container.decode(Int.self, forKey: .maxW)
        self.maxH = try container.decode(Int.self, forKey: .maxH)
        self.isLocked = try container.decode(Bool.self, forKey: .isLocked)
        self.aspectLock = try container.decodeIfPresent(Double.self, forKey: .aspectLock)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(instanceID, forKey: .instanceID)
        try container.encode(kind, forKey: .kind)
        try container.encodeIfPresent(trimmedTitle, forKey: .title)
        try container.encode(isHidden, forKey: .isHidden)
        try container.encode(x, forKey: .x)
        try container.encode(y, forKey: .y)
        try container.encode(w, forKey: .w)
        try container.encode(h, forKey: .h)
        try container.encode(minW, forKey: .minW)
        try container.encode(minH, forKey: .minH)
        try container.encode(maxW, forKey: .maxW)
        try container.encode(maxH, forKey: .maxH)
        try container.encode(isLocked, forKey: .isLocked)
        try container.encodeIfPresent(aspectLock, forKey: .aspectLock)
    }
}

struct LayoutMetrics {
    let columns: Int
    let gap: CGFloat
    let rowUnitHeight: CGFloat
    let colWidth: CGFloat

    var columnStep: CGFloat { colWidth + gap }
    var rowStep: CGFloat { rowUnitHeight + gap }
}

struct PlacedCard {
    let card: CardPlacement
    let frame: CGRect
}

enum LayoutInteractionKind: Equatable {
    case drag
    case resizeWidth
    case resizeHeight
    case resizeBoth
}

struct LayoutInteractionSession {
    let kind: LayoutInteractionKind
    let anchorID: UUID
    let startLayout: DashboardLayoutV2
    let pointerOrigin: CGPoint
    var lastResolvedLayout: DashboardLayoutV2
}
