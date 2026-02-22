//
//  SettingsView.swift
//  thirdscreen
//

import SwiftUI
import AppKit
import ServiceManagement

struct SettingsView: View {
    @Bindable var spotify: SpotifyService
    @Bindable var calendarService: CalendarService
    @Bindable var reminderService: ReminderService
    @Bindable var googleCalendarService: GoogleCalendarService

    var body: some View {
        TabView {
            GeneralSettingsTab()
                .tabItem {
                    Label("General", systemImage: "gearshape")
                }

            CalendarSettingsTab()
                .tabItem {
                    Label("Calendar", systemImage: "calendar")
                }

            AppearenceSettingsTab()
                .tabItem {
                    Label("Appearence", systemImage: "paintpalette")
                }

            ExternalConnectionsSettingsTab(
                    spotify: spotify,
                    calendarService: calendarService,
                    reminderService: reminderService,
                    googleCalendarService: googleCalendarService
                )
                .tabItem {
                    Label("Connections", systemImage: "link")
                }

            AboutSettingsTab()
                .tabItem {
                    Label("About", systemImage: "info.circle")
                }
        }
        .tabViewStyle(.sidebarAdaptable)
        .onAppear {
            DispatchQueue.main.async {
                if let w = NSApp.windows.first(where: {
                    $0.title == "Preferences" || $0.title == "Settings" || $0.title == "ThirdScreen Settings"
                }) {
                    w.title = "ThirdScreen Settings"
                }
            }
        }
    }
}

private struct GeneralSettingsTab: View {
    @AppStorage("launchAtLogin") private var launchAtLogin = false
    @State private var launchAtLoginError: String?

    var body: some View {
        Form {
            Section {
                Toggle("Launch at login", isOn: $launchAtLogin)
                Text("Start Third Screen automatically when you log in.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let error = launchAtLoginError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            Section("Time Cards") {
                Text("Time card appearance is now configured per card instance from each card header.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onAppear {
            launchAtLogin = (SMAppService.mainApp.status == .enabled)
            launchAtLoginError = nil
        }
        .onChange(of: launchAtLogin) { _, newValue in
            launchAtLoginError = nil
            do {
                if newValue {
                    try SMAppService.mainApp.register()
                } else {
                    try SMAppService.mainApp.unregister()
                }
            } catch {
                launchAtLoginError = "Could not update launch at login: \(error.localizedDescription)"
                launchAtLogin = !newValue
            }
        }
    }
}

private struct CalendarSettingsTab: View {
    @AppStorage("scheduleAutoRecenterIntervalSeconds") private var scheduleAutoRecenterIntervalSeconds = 60
    @AppStorage("schedulePrimaryStartHour") private var schedulePrimaryStartHour = 6
    @AppStorage("schedulePrimaryEndHour") private var schedulePrimaryEndHour = 22

    var body: some View {
        Form {
            Section("Schedule") {
                Picker("Auto-recenter current time", selection: $scheduleAutoRecenterIntervalSeconds) {
                    ForEach(ScheduleAutoRecenterOption.allCases) { option in
                        Text(option.label).tag(option.rawValue)
                    }
                }
                .pickerStyle(.menu)

                Picker("Primary day starts", selection: $schedulePrimaryStartHour) {
                    ForEach(0...22, id: \.self) { hour in
                        Text(formatHour(hour)).tag(hour)
                    }
                }
                .pickerStyle(.menu)

                Picker("Primary day ends", selection: $schedulePrimaryEndHour) {
                    ForEach(1...23, id: \.self) { hour in
                        Text(formatHour(hour)).tag(hour)
                    }
                }
                .pickerStyle(.menu)

                Text("Schedule still supports all 24 hours. Primary hours only define the default timeline window so sleeping hours can stay out of the way.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onAppear {
            normalizeScheduleSettings()
        }
        .onChange(of: schedulePrimaryStartHour) { _, _ in
            normalizeScheduleSettings()
        }
        .onChange(of: schedulePrimaryEndHour) { _, _ in
            normalizeScheduleSettings()
        }
    }

    private func normalizeScheduleSettings() {
        let clampedStart = min(max(schedulePrimaryStartHour, 0), 22)
        let clampedEnd = min(max(schedulePrimaryEndHour, 1), 23)

        if clampedStart != schedulePrimaryStartHour {
            schedulePrimaryStartHour = clampedStart
        }
        if clampedEnd != schedulePrimaryEndHour {
            schedulePrimaryEndHour = clampedEnd
        }
        if schedulePrimaryEndHour <= schedulePrimaryStartHour {
            schedulePrimaryEndHour = min(23, schedulePrimaryStartHour + 1)
        }
    }

    private func formatHour(_ hour: Int) -> String {
        var components = DateComponents()
        components.hour = hour
        components.minute = 0
        let date = Calendar.current.date(from: components) ?? Date()
        return date.formatted(date: .omitted, time: .shortened)
    }
}

private struct AppearenceSettingsTab: View {
    @AppStorage("appAppearanceMode") private var appAppearanceModeRaw: String = AppAppearanceMode.automatic.rawValue
    @AppStorage("appTextScale") private var appTextScale: Double = AppTextScale.defaultScale

    private var appAppearanceMode: AppAppearanceMode {
        AppAppearanceMode.fromStored(appAppearanceModeRaw)
    }

    var body: some View {
        Form {
            Section("System Appearance") {
                Picker("Mode", selection: $appAppearanceModeRaw) {
                    ForEach(AppAppearanceMode.allCases) { mode in
                        Text(mode.title).tag(mode.rawValue)
                    }
                }

                Text("Automatic follows your macOS Light/Dark setting.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("Accent color continues to follow your macOS Accent color setting.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Text Size") {
                HStack {
                    Text("Current size")
                    Spacer()
                    Text(AppTextScale.percentLabel(for: appTextScale))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                Slider(
                    value: $appTextScale,
                    in: AppTextScale.minScale...AppTextScale.maxScale,
                    step: AppTextScale.step
                )

                HStack(spacing: 10) {
                    Button("Smaller") {
                        appTextScale = AppTextScale.decremented(appTextScale)
                    }
                    .disabled(appTextScale <= AppTextScale.minScale + 0.0001)

                    Button("Default") {
                        appTextScale = AppTextScale.defaultScale
                    }
                    .disabled(abs(appTextScale - AppTextScale.defaultScale) < 0.0001)

                    Button("Larger") {
                        appTextScale = AppTextScale.incremented(appTextScale)
                    }
                    .disabled(appTextScale >= AppTextScale.maxScale - 0.0001)
                }

                Text("You can also use Command-Plus, Command-Minus, and Command-0 from the menu bar.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onAppear {
            appAppearanceModeRaw = appAppearanceMode.rawValue
            appTextScale = AppTextScale.roundedToStep(appTextScale)
        }
    }
}

private enum ScheduleAutoRecenterOption: Int, CaseIterable, Identifiable {
    case never = 0
    case fifteenSeconds = 15
    case thirtySeconds = 30
    case oneMinute = 60
    case twoMinutes = 120
    case fiveMinutes = 300

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .never:
            return "Never"
        case .fifteenSeconds:
            return "15 seconds"
        case .thirtySeconds:
            return "30 seconds"
        case .oneMinute:
            return "1 minute"
        case .twoMinutes:
            return "2 minutes"
        case .fiveMinutes:
            return "5 minutes"
        }
    }
}

private struct ExternalConnectionsSettingsTab: View {
    @Bindable var spotify: SpotifyService
    @Bindable var calendarService: CalendarService
    @Bindable var reminderService: ReminderService
    @Bindable var googleCalendarService: GoogleCalendarService
    @State private var showCalendarDisconnectAlert = false
    @State private var showReminderDisconnectAlert = false

    var body: some View {
        Form {
            Section {
                connectionRow(
                    title: "Apple Calendar",
                    subtitle: "Apple Calendar for schedule and events",
                    icon: "calendar",
                    isConnected: calendarService.isAuthorized,
                    onConnect: { Task { _ = await calendarService.requestAccess() } },
                    onDisconnect: calendarService.isAuthorized ? { showCalendarDisconnectAlert = true } : nil,
                    openSystemSettings: calendarService.isDenied ? { calendarService.openSystemSettings() } : nil
                )

                connectionRow(
                    title: "Apple Reminders",
                    subtitle: "Two-way sync for to-dos",
                    icon: "checklist",
                    isConnected: reminderService.isAuthorized,
                    onConnect: { Task { _ = await reminderService.requestAccess() } },
                    onDisconnect: reminderService.isAuthorized ? { showReminderDisconnectAlert = true } : nil,
                    openSystemSettings: reminderService.isDenied ? { reminderService.openSystemSettings() } : nil
                )
                if let reminderError = reminderService.lastErrorMessage, !reminderError.isEmpty {
                    Text(reminderError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                connectionRow(
                    title: "Google Calendar",
                    subtitle: "Google Calendar sync for schedule events",
                    icon: "google.calendar.logo",
                    isConnected: googleCalendarService.isConnected,
                    onConnect: {
                        googleCalendarService.connect()
                    },
                    onDisconnect: googleCalendarService.isConnected ? {
                        googleCalendarService.disconnect()
                    } : nil,
                    openSystemSettings: nil,
                    isConnecting: googleCalendarService.isConnecting,
                    connectButtonTitle: googleCalendarService.isConfigured ? "Connect" : "Configure",
                    connectDisabled: !googleCalendarService.isConfigured
                )
                if !googleCalendarService.isConfigured {
                    Text("Add `GoogleCalendarClientID` and `GoogleCalendarRedirectURI` to Info.plist, then reconnect.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let googleError = googleCalendarService.connectionError, !googleError.isEmpty {
                    Text(googleError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                connectionRow(
                    title: "Spotify",
                    subtitle: "Music playback and now playing",
                    icon: "spotify.logo",
                    isConnected: spotify.isConnected,
                    onConnect: { spotify.connect() },
                    onDisconnect: spotify.isConnected ? { spotify.disconnect() } : nil,
                    openSystemSettings: nil,
                    isConnecting: spotify.isConnecting
                )
            }
        }
        .formStyle(.grouped)
        .alert("Disconnect Calendar", isPresented: $showCalendarDisconnectAlert) {
            Button("Open Settings") { calendarService.openSystemSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("To disconnect Calendar, you need to manually revoke Third Screen's access in System Settings under Privacy & Security → Calendars.")
        }
        .alert("Disconnect Reminders", isPresented: $showReminderDisconnectAlert) {
            Button("Open Settings") { reminderService.openSystemSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("To disconnect Reminders, manually revoke Third Screen's access in System Settings under Privacy & Security → Reminders.")
        }
    }

    private func connectionRow(
        title: String,
        subtitle: String,
        icon: String,
        isConnected: Bool,
        onConnect: @escaping () -> Void,
        onDisconnect: (() -> Void)?,
        openSystemSettings: (() -> Void)?,
        isConnecting: Bool = false,
        connectButtonTitle: String = "Connect",
        connectDisabled: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            connectionIcon(for: icon, isConnected: isConnected)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    if isConnected {
                        Label("Connected", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                        if let onDisconnect {
                            Button("Disconnect") { onDisconnect() }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        }
                    } else {
                        if let openSystemSettings {
                            Button("Open System Settings") { openSystemSettings() }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        } else {
                            Button(connectButtonTitle) { onConnect() }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.small)
                                .disabled(isConnecting || connectDisabled)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func connectionIcon(for icon: String, isConnected: Bool) -> some View {
        if icon == "spotify.logo" {
            Image("SpotifyOfficial")
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .opacity(isConnected ? 1 : 0.7)
                .frame(width: 24, alignment: .center)
        } else if icon == "google.calendar.logo" {
            Image("GoogleCalendarOfficial")
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .opacity(isConnected ? 1 : 0.7)
                .frame(width: 24, alignment: .center)
        } else {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(isConnected ? .green : .secondary)
                .frame(width: 24, alignment: .center)
        }
    }
}

private struct AboutSettingsTab: View {
    var body: some View {
        Form {
            Section {
                HStack {
                    Text("ThirdScreen")
                        .font(.title2)
                    Spacer()
                }
                HStack {
                    Text("Version")
                    Spacer()
                    Text("1.0")
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text("GitHub")
                    Spacer()
                    Button("View on GitHub") {
                        if let url = URL(string: "https://github.com/your-org/thirdscreen") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .formStyle(.grouped)
    }
}
