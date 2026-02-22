//
//  ReminderService.swift
//  thirdscreen
//

import Foundation
import EventKit
import AppKit

private let syncReminderCalendarTitle = "Third Screen"

struct ReminderSnapshot: Identifiable, Equatable {
    let id: String
    let title: String
    let isCompleted: Bool
    let dueDate: Date?
    let createdAt: Date?
    let lastModifiedAt: Date?
}

@Observable
final class ReminderService {
    private let store = EKEventStore()
    private var eventStoreObserver: NSObjectProtocol?

    private(set) var isAuthorized = false
    private(set) var hasLoadedReminders = false
    private(set) var reminders: [ReminderSnapshot] = []
    private(set) var lastErrorMessage: String?

    var onRemindersChanged: (([ReminderSnapshot]) -> Void)?

    init() {
        eventStoreObserver = NotificationCenter.default.addObserver(
            forName: .EKEventStoreChanged,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task {
                await self.refreshAuthorizationStatus()
            }
        }
    }

    deinit {
        if let eventStoreObserver {
            NotificationCenter.default.removeObserver(eventStoreObserver)
        }
    }

    var isDenied: Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        return status == .denied || status == .restricted
    }

    func openSystemSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders") {
            NSWorkspace.shared.open(url)
        }
    }

    func requestAccess() async -> Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        if Self.hasReminderReadAccess(status) {
            isAuthorized = true
            lastErrorMessage = nil
            await fetchReminders()
            return true
        }

        if #available(macOS 14.0, *) {
            isAuthorized = (try? await store.requestFullAccessToReminders()) ?? false
        } else {
            isAuthorized = await withCheckedContinuation { continuation in
                store.requestAccess(to: .reminder) { granted, _ in
                    continuation.resume(returning: granted)
                }
            }
        }

        if isAuthorized {
            lastErrorMessage = nil
            await fetchReminders()
        } else {
            lastErrorMessage = "Reminders access was not granted."
        }

        return isAuthorized
    }

    func refreshAuthorizationStatus() async {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        let granted = Self.hasReminderReadAccess(status)

        if granted != isAuthorized {
            isAuthorized = granted
        }

        if granted {
            await fetchReminders()
        } else {
            hasLoadedReminders = false
            lastErrorMessage = nil
            if !reminders.isEmpty {
                reminders = []
                onRemindersChanged?(reminders)
            }
        }
    }

    func fetchReminders() async {
        guard isAuthorized else { return }
        guard let calendar = syncReminderCalendar() else {
            hasLoadedReminders = true
            if !reminders.isEmpty {
                reminders = []
                onRemindersChanged?(reminders)
            }
            return
        }

        let predicate = store.predicateForReminders(in: [calendar])
        let fetched = await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { reminders in
                continuation.resume(returning: reminders ?? [])
            }
        }

        let snapshots = fetched
            .map(Self.snapshot(from:))
            .sorted { lhs, rhs in
                if lhs.createdAt != rhs.createdAt {
                    return (lhs.createdAt ?? .distantPast) < (rhs.createdAt ?? .distantPast)
                }
                return lhs.id < rhs.id
            }

        let isFirstLoad = !hasLoadedReminders
        hasLoadedReminders = true
        if isFirstLoad || snapshots != reminders {
            reminders = snapshots
            onRemindersChanged?(snapshots)
        }
        lastErrorMessage = nil
    }

    func createReminder(for todo: TodoItem) -> String? {
        guard isAuthorized, let calendar = syncReminderCalendar() else { return nil }

        let reminder = EKReminder(eventStore: store)
        reminder.calendar = calendar
        apply(todo: todo, to: reminder)

        do {
            try store.save(reminder, commit: true)
            Task { await fetchReminders() }
            return reminder.calendarItemIdentifier
        } catch {
            return nil
        }
    }

    @discardableResult
    func updateReminder(identifier: String, from todo: TodoItem) -> Bool {
        guard isAuthorized,
              let reminder = store.calendarItem(withIdentifier: identifier) as? EKReminder
        else { return false }

        apply(todo: todo, to: reminder)
        do {
            try store.save(reminder, commit: true)
            Task { await fetchReminders() }
            return true
        } catch {
            return false
        }
    }

    func deleteReminder(identifier: String) {
        guard isAuthorized,
              let reminder = store.calendarItem(withIdentifier: identifier) as? EKReminder
        else { return }

        do {
            try store.remove(reminder, commit: true)
            Task { await fetchReminders() }
        } catch {}
    }

    func reminderExists(identifier: String) -> Bool {
        guard isAuthorized else { return false }
        return store.calendarItem(withIdentifier: identifier) is EKReminder
    }

    private func syncReminderCalendar() -> EKCalendar? {
        if let existing = store.calendars(for: .reminder).first(
            where: { $0.title == syncReminderCalendarTitle && $0.source.sourceType == .local }
        ) {
            return existing
        }
        return createSyncReminderCalendar()
    }

    private func createSyncReminderCalendar() -> EKCalendar? {
        guard let localSource = store.sources.first(where: { $0.sourceType == .local }) else {
            lastErrorMessage = "No local Reminders source is available on this Mac."
            return nil
        }

        let calendar = EKCalendar(for: .reminder, eventStore: store)
        calendar.title = syncReminderCalendarTitle
        calendar.source = localSource
        calendar.cgColor = CGColor(red: 0.43, green: 0.61, blue: 0.78, alpha: 1)

        do {
            try store.saveCalendar(calendar, commit: true)
            lastErrorMessage = nil
            return calendar
        } catch {
            lastErrorMessage = "Failed to create the local Third Screen reminders list."
            return nil
        }
    }

    private func apply(todo: TodoItem, to reminder: EKReminder) {
        let trimmedTitle = todo.title.trimmingCharacters(in: .whitespacesAndNewlines)
        reminder.title = trimmedTitle.isEmpty ? "Untitled" : trimmedTitle
        reminder.dueDateComponents = dueDateComponents(from: todo.scheduledStart)

        if todo.isCompleted {
            reminder.isCompleted = true
            if reminder.completionDate == nil {
                reminder.completionDate = Date()
            }
        } else {
            reminder.isCompleted = false
            reminder.completionDate = nil
        }
    }

    private func dueDateComponents(from date: Date?) -> DateComponents? {
        guard let date else { return nil }
        var components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        components.calendar = Calendar.current
        components.timeZone = TimeZone.current
        return components
    }

    private static func snapshot(from reminder: EKReminder) -> ReminderSnapshot {
        let trimmedTitle = reminder.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return ReminderSnapshot(
            id: reminder.calendarItemIdentifier,
            title: trimmedTitle.isEmpty ? "Untitled" : trimmedTitle,
            isCompleted: reminder.isCompleted,
            dueDate: dueDate(from: reminder.dueDateComponents),
            createdAt: reminder.creationDate,
            lastModifiedAt: reminder.lastModifiedDate
        )
    }

    private static func dueDate(from components: DateComponents?) -> Date? {
        guard let components else { return nil }
        if let calendar = components.calendar, let date = calendar.date(from: components) {
            return date
        }
        return Calendar.current.date(from: components)
    }

    private static func hasReminderReadAccess(_ status: EKAuthorizationStatus) -> Bool {
        if #available(macOS 14.0, *) {
            return status == .fullAccess
        } else {
            return status == .authorized
        }
    }
}
