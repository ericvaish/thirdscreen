import XCTest
@testable import thirdscreen

final class MeetingLinkExtractorTests: XCTestCase {
    func testZoomDetectionFromFreeText() throws {
        let info = MeetingLinkExtractor.extractFromApple(
            eventURL: nil,
            notes: "Join us: https://company.zoom.us/j/123456789?pwd=abc",
            location: nil
        )

        XCTAssertNotNil(info)
        XCTAssertEqual(info?.provider, .zoom)
        XCTAssertEqual(info?.url.host, "company.zoom.us")
    }

    func testMeetDetectionFromConferenceEntryPoint() {
        let info = MeetingLinkExtractor.extractFromGoogle(
            hangoutLink: nil,
            conferenceEntryURIs: ["https://meet.google.com/abc-defg-hij"],
            location: nil,
            description: nil
        )

        XCTAssertNotNil(info)
        XCTAssertEqual(info?.provider, .googleMeet)
        XCTAssertEqual(info?.url.host, "meet.google.com")
    }

    func testGenericHttpsFallback() {
        let info = MeetingLinkExtractor.extractFromApple(
            eventURL: nil,
            notes: "Call details at https://example.com/meetings/42",
            location: nil
        )

        XCTAssertNotNil(info)
        XCTAssertEqual(info?.provider, .generic)
        XCTAssertEqual(info?.url.absoluteString, "https://example.com/meetings/42")
    }

    func testNormalizationStabilityRemovesTrackingAndSortsQuery() {
        let url1 = URL(string: "https://Meet.Google.com/abc-defg-hij?z=2&utm_source=x&a=1#fragment")!
        let url2 = URL(string: "https://meet.google.com/abc-defg-hij?a=1&z=2")!

        let key1 = MeetingLinkExtractor.normalizedURLKey(for: url1)
        let key2 = MeetingLinkExtractor.normalizedURLKey(for: url2)

        XCTAssertEqual(key1, key2)
        XCTAssertEqual(key1, "https://meet.google.com/abc-defg-hij?a=1&z=2")
    }

    func testDedupCollisionPrefersSpecificProviderThenGoogleOrigin() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let end = start.addingTimeInterval(1800)

        let genericJoin = MeetingJoinInfo(
            url: URL(string: "https://example.com/call?id=7")!,
            provider: .generic,
            normalizedKey: "https://example.com/call?id=7"
        )
        let zoomJoin = MeetingJoinInfo(
            url: URL(string: "https://example.com/call?id=7")!,
            provider: .zoom,
            normalizedKey: "https://example.com/call?id=7"
        )

        let appleItem = ScheduleItem(
            id: "apple-1",
            title: "A",
            startDate: start,
            endDate: end,
            source: .calendar,
            joinInfo: genericJoin,
            calendarOrigin: .apple
        )
        let googleItem = ScheduleItem(
            id: "google-1",
            title: "Longer Google Title",
            startDate: start,
            endDate: end,
            source: .calendar,
            joinInfo: zoomJoin,
            calendarOrigin: .google
        )

        let deduped = CalendarMeetingDeduplicator.dedupe([appleItem, googleItem])

        XCTAssertEqual(deduped.count, 1)
        XCTAssertEqual(deduped.first?.id, "google-1")
        XCTAssertEqual(deduped.first?.joinInfo?.provider, .zoom)
    }
}
