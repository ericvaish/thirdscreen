import XCTest
@testable import thirdscreen

final class LayoutEngineDuplicateCardsTests: XCTestCase {
    private let engine = LayoutEngine()

    func testSanitizePreservesDuplicateKinds() {
        let cardA = CardPlacement(kind: .timer, x: 0, y: 0, w: 12, h: 8)
        let cardB = CardPlacement(kind: .timer, x: 0, y: 0, w: 12, h: 8)
        let layout = DashboardLayoutV2(cards: [cardA, cardB])

        let sanitized = engine.sanitize(layout)
        let timers = sanitized.cards.filter { $0.kind == .timer }

        XCTAssertEqual(timers.count, 2)
        XCTAssertNotEqual(timers[0].instanceID, timers[1].instanceID)
    }

    func testAddCardAllowsSameKindMultipleTimes() {
        let once = engine.addCard(kind: .media, to: .default)
        let twice = engine.addCard(kind: .media, to: once)

        let mediaCards = twice.cards.filter { $0.kind == .media }
        XCTAssertEqual(mediaCards.count, 3)
        XCTAssertEqual(Set(mediaCards.map(\.instanceID)).count, mediaCards.count)
    }

    func testResolvedLayoutMutatesOnlyActiveDuplicate() {
        let cardA = CardPlacement(kind: .timer, x: 0, y: 0, w: 10, h: 8)
        let cardB = CardPlacement(kind: .timer, x: 12, y: 0, w: 10, h: 8)
        let layout = DashboardLayoutV2(cards: [cardA, cardB])

        let moved = engine.resolvedLayout(
            from: layout,
            activeCardID: cardA.instanceID,
            proposedRect: GridRect(x: 1, y: 2, w: 10, h: 8),
            compactAfter: false
        )

        let resolvedA = moved.card(for: cardA.instanceID)
        let resolvedB = moved.card(for: cardB.instanceID)

        XCTAssertEqual(resolvedA?.x, 1)
        XCTAssertEqual(resolvedA?.y, 2)
        XCTAssertEqual(resolvedB?.rect, cardB.rect)
    }

    func testHiddenCardExcludedFromCollisionsAndRestoredWithoutOverlap() {
        let visible = CardPlacement(kind: .timer, x: 0, y: 0, w: 12, h: 8)
        var hidden = CardPlacement(kind: .timer, x: 0, y: 0, w: 12, h: 8)
        hidden.isHidden = true
        let layout = DashboardLayoutV2(cards: [visible, hidden])

        let sanitized = engine.sanitize(layout)
        XCTAssertTrue(engine.validation(for: sanitized).isValid)

        let shown = engine.setCardHidden(hidden.instanceID, hidden: false, in: sanitized)
        let shownVisible = shown.visibleCards

        XCTAssertEqual(shownVisible.count, 2)
        XCTAssertFalse(shownVisible[0].rect.intersects(shownVisible[1].rect))
        XCTAssertTrue(engine.validation(for: shown).isValid)
    }
}
