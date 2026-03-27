import XCTest
@testable import thirdscreen

final class CardInstanceSettingsMigrationTests: XCTestCase {
    func testSeedMissingSettingsFromLegacy() {
        let timer = CardPlacement(kind: .timer, x: 0, y: 0, w: 12, h: 8)
        let media = CardPlacement(kind: .media, x: 12, y: 0, w: 12, h: 8)
        let schedule = CardPlacement(kind: .schedule, x: 0, y: 8, w: 24, h: 10)
        let cards = [timer, media, schedule]

        var store = CardInstanceSettingsStore.empty
        let legacyTime = TimeCardConfig(
            clockPresentationRaw: TimeCardClockPresentation.analog.rawValue,
            digitalStyleRaw: TimeCardDigitalClockStyle.board.rawValue,
            analogStyleRaw: TimeCardAnalogClockStyle.chronograph.rawValue,
            showSeconds: false,
            use24Hour: true,
            selectedTimeZoneID: "America/New_York",
            worldTimeZoneIDsRaw: TimeCardPreferences.defaultWorldTimeZoneIDsStorage
        )

        store.seedMissingFromLegacy(for: cards, legacyTime: legacyTime, legacyMediaShowLyrics: false)

        XCTAssertEqual(store.timeConfig(for: timer.instanceID), legacyTime)
        XCTAssertEqual(store.mediaConfig(for: media.instanceID)?.provider, .spotify)
        XCTAssertEqual(store.mediaConfig(for: media.instanceID)?.showLyrics, false)
        XCTAssertNil(store.timeConfig(for: schedule.instanceID))
        XCTAssertNil(store.mediaConfig(for: schedule.instanceID))
    }
}
