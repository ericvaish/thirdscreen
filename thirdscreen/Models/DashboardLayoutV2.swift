import Foundation
import CoreGraphics

struct DashboardLayoutV2: Codable, Equatable {
    static let currentVersion = 3
    static let defaultColumns = 24
    static let defaultRowUnitHeight: CGFloat = 60
    static let defaultGap: CGFloat = 16

    var cards: [CardPlacement]
    var gridColumns: Int
    var rowUnitHeight: CGFloat
    var gap: CGFloat
    var compactMode: CompactMode
    var layoutVersion: Int

    init(
        cards: [CardPlacement] = DashboardLayoutV2.defaultCards,
        gridColumns: Int = DashboardLayoutV2.defaultColumns,
        rowUnitHeight: CGFloat = DashboardLayoutV2.defaultRowUnitHeight,
        gap: CGFloat = DashboardLayoutV2.defaultGap,
        compactMode: CompactMode = .vertical,
        layoutVersion: Int = DashboardLayoutV2.currentVersion
    ) {
        self.cards = cards
        self.gridColumns = max(1, gridColumns)
        self.rowUnitHeight = max(24, rowUnitHeight)
        self.gap = max(4, gap)
        self.compactMode = compactMode
        self.layoutVersion = layoutVersion
    }

    static var `default`: DashboardLayoutV2 {
        DashboardLayoutV2(cards: defaultCards)
    }

    static var defaultCards: [CardPlacement] {
        [
            defaultCard(for: .timer, x: 0, y: 0),
            defaultCard(for: .media, x: 12, y: 0),
            defaultCard(for: .schedule, x: 0, y: 8),
            defaultCard(for: .todos, x: 0, y: 18),
        ]
    }

    static func defaultCard(for section: DashboardSection, x: Int = 0, y: Int = 0) -> CardPlacement {
        let base: CardPlacement
        switch section {
        case .timer:
            base = CardPlacement(kind: .timer, x: x, y: y, w: 12, h: 8)
        case .media:
            base = CardPlacement(kind: .media, x: x, y: y, w: 12, h: 8)
        case .schedule:
            base = CardPlacement(kind: .schedule, x: x, y: y, w: 24, h: 10)
        case .calendar:
            base = CardPlacement(kind: .calendar, x: x, y: y, w: 12, h: 8)
        case .todos:
            base = CardPlacement(kind: .todos, x: x, y: y, w: 24, h: 8)
        case .battery:
            base = CardPlacement(kind: .battery, x: x, y: y, w: 12, h: 8)
        }
        return CardLayoutPolicy.policy(for: section).normalize(base, columns: defaultColumns)
    }

    var visibleCards: [CardPlacement] {
        cards.filter { !$0.isHidden }
    }

    var visibleSections: [DashboardSection] {
        visibleCards.map(\.kind)
    }

    func card(for instanceID: UUID) -> CardPlacement? {
        cards.first { $0.instanceID == instanceID }
    }

    func cards(of kind: DashboardSection) -> [CardPlacement] {
        cards.filter { $0.kind == kind }
    }

    mutating func updateCard(_ instanceID: UUID, _ mutate: (inout CardPlacement) -> Void) {
        guard let index = cards.firstIndex(where: { $0.instanceID == instanceID }) else { return }
        mutate(&cards[index])
    }

    mutating func replaceCard(_ card: CardPlacement) {
        guard let index = cards.firstIndex(where: { $0.instanceID == card.instanceID }) else { return }
        cards[index] = card
    }

    mutating func removeCard(_ instanceID: UUID) {
        cards.removeAll { $0.instanceID == instanceID }
    }

    mutating func addCard(_ card: CardPlacement) {
        cards.append(card)
    }

    var maxGridY: Int {
        visibleCards.map { $0.y + $0.h }.max() ?? 0
    }

    func metrics(for availableWidth: CGFloat) -> LayoutMetrics {
        let safeColumns = max(1, gridColumns)
        let totalGaps = CGFloat(max(0, safeColumns - 1)) * gap
        let colWidth = max(8, (availableWidth - totalGaps) / CGFloat(safeColumns))
        return LayoutMetrics(columns: safeColumns, gap: gap, rowUnitHeight: rowUnitHeight, colWidth: colWidth)
    }

    func placedCards(availableWidth: CGFloat) -> [PlacedCard] {
        let metrics = metrics(for: availableWidth)
        return visibleCards.map { card in
            let frame = CGRect(
                x: CGFloat(card.x) * metrics.columnStep,
                y: CGFloat(card.y) * metrics.rowStep,
                width: CGFloat(card.w) * metrics.colWidth + CGFloat(max(0, card.w - 1)) * metrics.gap,
                height: CGFloat(card.h) * metrics.rowUnitHeight + CGFloat(max(0, card.h - 1)) * metrics.gap
            )
            return PlacedCard(card: card, frame: frame)
        }
    }

    static func decodeWithMigration(v2Data: Data, legacyData: Data?) -> DashboardLayoutV2? {
        if !v2Data.isEmpty, let v2 = try? JSONDecoder().decode(DashboardLayoutV2.self, from: v2Data) {
            return v2
        }
        guard let legacyData else { return nil }
        guard let legacy = DashboardLayout.decodeWithMigration(from: legacyData) else { return nil }
        return fromLegacy(legacy)
    }

    static func fromLegacy(_ legacy: DashboardLayout) -> DashboardLayoutV2 {
        var cards: [CardPlacement] = []
        var currentX = 0
        var currentY = 0
        var rowBottom = 0

        for section in legacy.orderedSections {
            let spanW = max(1, min(defaultColumns, section.colSpan))
            let spanH = max(1, section.rowSpan)

            if currentX + spanW > defaultColumns {
                currentX = 0
                currentY = rowBottom
            }

            let card = defaultCard(for: section.id, x: currentX, y: currentY)
            let migrated = CardPlacement(
                instanceID: UUID(),
                kind: card.kind,
                title: nil,
                isHidden: false,
                x: currentX,
                y: currentY,
                w: spanW,
                h: spanH,
                minW: card.minW,
                minH: card.minH,
                maxW: card.maxW,
                maxH: card.maxH,
                isLocked: false,
                aspectLock: nil
            )
            cards.append(CardLayoutPolicy.policy(for: section.id).normalize(migrated, columns: defaultColumns))

            rowBottom = max(rowBottom, currentY + spanH)
            currentX += spanW
            if currentX >= defaultColumns {
                currentX = 0
                currentY = rowBottom
            }
        }

        return DashboardLayoutV2(cards: cards)
    }
}

extension LayoutPreset {
    var layoutV2: DashboardLayoutV2 {
        DashboardLayoutV2.fromLegacy(layout)
    }
}
