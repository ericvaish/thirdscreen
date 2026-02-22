//
//  AppTheme.swift
//  thirdscreen
//

import SwiftUI
import AppKit

struct AppThemeDefinition: Identifiable, Hashable {
    let id: String
    let displayName: String
    let preferredColorScheme: ColorScheme?
    let appKitAppearanceName: NSAppearance.Name?
}

enum AppThemeCatalog {
    static let defaultThemeID = "automatic"

    static let themes: [AppThemeDefinition] = [
        AppThemeDefinition(
            id: "automatic",
            displayName: "Automatic",
            preferredColorScheme: nil,
            appKitAppearanceName: nil
        ),
        AppThemeDefinition(
            id: "light",
            displayName: "Light",
            preferredColorScheme: .light,
            appKitAppearanceName: .aqua
        ),
        AppThemeDefinition(
            id: "dark",
            displayName: "Dark",
            preferredColorScheme: .dark,
            appKitAppearanceName: .darkAqua
        )
    ]

    static func theme(for id: String) -> AppThemeDefinition {
        themes.first(where: { $0.id == id }) ?? themes[0]
    }
}

private struct AppThemeKey: EnvironmentKey {
    static let defaultValue: AppThemeDefinition = AppThemeCatalog.theme(for: AppThemeCatalog.defaultThemeID)
}

extension EnvironmentValues {
    var appTheme: AppThemeDefinition {
        get { self[AppThemeKey.self] }
        set { self[AppThemeKey.self] = newValue }
    }
}

private struct AppThemeTintKey: EnvironmentKey {
    static let defaultValue: Color? = nil
}

extension EnvironmentValues {
    var appThemeTint: Color? {
        get { self[AppThemeTintKey.self] }
        set { self[AppThemeTintKey.self] = newValue }
    }
}
