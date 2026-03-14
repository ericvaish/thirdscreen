//
//  thirdscreenApp.swift
//  thirdscreen
//
//  Created by Eric Vaish on 21/02/26.
//

import SwiftUI
import AppKit
import Sparkle

/// Wrapper so Sparkle's updater can be shared via SwiftUI environment.
@MainActor @Observable
final class AppUpdater {
    let controller: SPUStandardUpdaterController

    var canCheckForUpdates: Bool { controller.updater.canCheckForUpdates }
    var automaticallyChecksForUpdates: Bool {
        get { controller.updater.automaticallyChecksForUpdates }
        set { controller.updater.automaticallyChecksForUpdates = newValue }
    }

    init() {
        controller = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    func checkForUpdates() {
        controller.updater.checkForUpdates()
    }
}

private struct AppMenuCommands: Commands {
    @Environment(\.openWindow) private var openWindow
    @Binding var textScale: Double
    var appUpdater: AppUpdater

    private var normalizedScale: Double {
        AppTextScale.clamp(textScale)
    }

    private var canZoomIn: Bool {
        normalizedScale < (AppTextScale.maxScale - 0.0001)
    }

    private var canZoomOut: Bool {
        normalizedScale > (AppTextScale.minScale + 0.0001)
    }

    var body: some Commands {
        CommandGroup(replacing: .appSettings) {
            Button("Check for Updates...") {
                appUpdater.checkForUpdates()
            }
            .disabled(!appUpdater.canCheckForUpdates)

            Divider()

            Button("Settings...") {
                openWindow(id: "settings")
            }
            .keyboardShortcut(",", modifiers: .command)
        }

        CommandGroup(after: .toolbar) {
            Divider()

            Button("Zoom In") {
                textScale = AppTextScale.incremented(normalizedScale)
            }
            .keyboardShortcut("=", modifiers: .command)
            .disabled(!canZoomIn)

            Button("Zoom Out") {
                textScale = AppTextScale.decremented(normalizedScale)
            }
            .keyboardShortcut("-", modifiers: .command)
            .disabled(!canZoomOut)

            Button("Actual Size") {
                textScale = AppTextScale.defaultScale
            }
            .keyboardShortcut("0", modifiers: .command)
            .disabled(abs(normalizedScale - AppTextScale.defaultScale) < 0.0001)
        }
    }
}

enum AppAppearanceMode: String, CaseIterable, Identifiable {
    case automatic
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic:
            return "Automatic"
        case .light:
            return "Light"
        case .dark:
            return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .automatic:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }

    var appKitAppearance: NSAppearance? {
        switch self {
        case .automatic:
            return nil
        case .light:
            return NSAppearance(named: .aqua)
        case .dark:
            return NSAppearance(named: .darkAqua)
        }
    }

    static func fromStored(_ rawValue: String) -> AppAppearanceMode {
        AppAppearanceMode(rawValue: rawValue) ?? .automatic
    }
}

@main
struct thirdscreenApp: App {
    @State private var appUpdater = AppUpdater()
    @State private var spotifyService = SpotifyService()
    @State private var calendarService = CalendarService()
    @State private var reminderService = ReminderService()
    @State private var googleCalendarService = GoogleCalendarService()
    @State private var shortcutsService = ShortcutsService()
    @State private var llmService = LocalLLMService()
    @State private var timerService = TimerService()
    @State private var toastManager = ToastManager()
    @AppStorage("appAppearanceMode") private var appAppearanceModeRaw: String = AppAppearanceMode.automatic.rawValue
    @AppStorage("appTextScale") private var appTextScaleRaw: Double = AppTextScale.defaultScale

    private var appAppearanceMode: AppAppearanceMode {
        AppAppearanceMode.fromStored(appAppearanceModeRaw)
    }

    private var appTextScale: Double {
        AppTextScale.clamp(appTextScaleRaw)
    }

    private func applyAppAppearance() {
        NSApp.appearance = appAppearanceMode.appKitAppearance
    }

    private func clampStoredTextScaleIfNeeded(_ value: Double) {
        let clamped = AppTextScale.clamp(value)
        if clamped != value {
            appTextScaleRaw = clamped
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView(
                spotifyService: spotifyService,
                calendarService: calendarService,
                reminderService: reminderService,
                googleCalendarService: googleCalendarService,
                shortcutsService: shortcutsService,
                llmService: llmService,
                timerService: timerService
            )
            .overlay { ToastOverlayView(toastManager: toastManager) }
            .environment(toastManager)
            .environment(\.appTextScale, appTextScale)
            .dynamicTypeSize(AppTextScale.dynamicTypeSize(for: appTextScale))
            .preferredColorScheme(appAppearanceMode.colorScheme)
            .onAppear {
                applyAppAppearance()
                clampStoredTextScaleIfNeeded(appTextScaleRaw)
            }
            .onAppear {
                timerService.toastManager = toastManager
                llmService.registerTools(timerService: timerService, toastManager: toastManager)
            }
            .task {
                await llmService.refreshOllamaModels()
                // Periodic Ollama refresh every 30s
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(30))
                    await llmService.refreshOllamaModels()
                }
            }
            .onChange(of: appAppearanceModeRaw) { _, _ in
                applyAppAppearance()
            }
            .onChange(of: appTextScaleRaw) { _, newValue in
                clampStoredTextScaleIfNeeded(newValue)
            }
        }
        .commands {
            AppMenuCommands(textScale: $appTextScaleRaw, appUpdater: appUpdater)
        }
        .defaultSize(width: 900, height: 700)
        // Use a regular Window scene (not Settings scene) so macOS keeps
        // standard rounded window chrome and allows user resizing.
        Window("ThirdScreen Settings", id: "settings") {
            SettingsView(
                spotify: spotifyService,
                calendarService: calendarService,
                reminderService: reminderService,
                googleCalendarService: googleCalendarService,
                llmService: llmService,
                appUpdater: appUpdater
            )
            .environment(\.appTextScale, appTextScale)
            .dynamicTypeSize(AppTextScale.dynamicTypeSize(for: appTextScale))
            .preferredColorScheme(appAppearanceMode.colorScheme)
            .onAppear {
                applyAppAppearance()
                clampStoredTextScaleIfNeeded(appTextScaleRaw)
            }
            .onChange(of: appAppearanceModeRaw) { _, _ in
                applyAppAppearance()
            }
            .onChange(of: appTextScaleRaw) { _, newValue in
                clampStoredTextScaleIfNeeded(newValue)
            }
        }
        .defaultSize(width: 560, height: 400)
        .windowResizability(.contentMinSize)
    }
}
