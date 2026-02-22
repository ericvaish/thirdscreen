import XCTest
@testable import thirdscreen

final class CardPlacementMigrationTests: XCTestCase {
    @MainActor
    func testLegacyV2CardPayloadDecodesToNewShape() throws {
        let json = """
        {
          "id": "timer",
          "x": 1,
          "y": 2,
          "w": 12,
          "h": 8,
          "minW": 8,
          "minH": 5,
          "maxW": 24,
          "maxH": 24,
          "isLocked": false,
          "aspectLock": null
        }
        """.data(using: .utf8)!

        let card = try JSONDecoder().decode(CardPlacement.self, from: json)

        XCTAssertEqual(card.kind, .timer)
        XCTAssertEqual(card.x, 1)
        XCTAssertEqual(card.y, 2)
        XCTAssertEqual(card.w, 12)
        XCTAssertEqual(card.h, 8)
        XCTAssertFalse(card.isHidden)
    }
}
