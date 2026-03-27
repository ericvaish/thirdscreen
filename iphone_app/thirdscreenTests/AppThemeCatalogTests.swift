import XCTest
@testable import thirdscreen

final class AppThemeCatalogTests: XCTestCase {
    func testDefaultThemeExists() {
        let defaultTheme = AppThemeCatalog.theme(for: AppThemeCatalog.defaultThemeID)
        XCTAssertEqual(defaultTheme.id, AppThemeCatalog.defaultThemeID)
    }

    func testThemeIDsAreUnique() {
        let ids = AppThemeCatalog.themes.map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count, "Theme IDs must be unique.")
    }

    func testUnknownThemeFallsBackToDefault() {
        let fallback = AppThemeCatalog.theme(for: "__missing_theme__")
        XCTAssertEqual(fallback.id, AppThemeCatalog.defaultThemeID)
    }
}
