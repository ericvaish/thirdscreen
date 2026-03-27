//
//  CalendarService.swift
//  thirdscreen
//

import Foundation
import EventKit
import AppKit

private let blockingCalendarTitle = "Third Screen"

enum CalendarServiceEditError: LocalizedError {
    case unauthorized
    case eventNotFound
    case saveFailed

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Apple Calendar access is not available."
        case .eventNotFound:
            return "The Apple Calendar event could not be found."
        case .saveFailed:
            return "Failed to update Apple Calendar event."
        }
    }
}

@Observable
final class CalendarService {
    private let store = EKEventStore()
    private var eventStoreObserver: NSObjectProtocol?
    private(set) var isAuthorized = false
    private(set) var events: [EKEvent] = []

    init() {
        eventStoreObserver = NotificationCenter.default.addObserver(
            forName: .EKEventStoreChanged,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { await self.fetchEvents() }
        }
    }

    var isDenied: Bool {
        EKEventStore.authorizationStatus(for: .event) == .denied
    }

    func openSystemSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars") {
            NSWorkspace.shared.open(url)
        }
    }

    func requestAccess() async -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        let granted: Bool
        if #available(macOS 14.0, *) {
            granted = status == .fullAccess
        } else {
            granted = status == .authorized
        }
        if granted {
            isAuthorized = true
            await fetchEvents()
            return true
        }
        if #available(macOS 14.0, *) {
            isAuthorized = (try? await store.requestFullAccessToEvents()) ?? false
        } else {
            isAuthorized = await withCheckedContinuation { cont in
                store.requestAccess(to: .event) { granted, _ in
                    cont.resume(returning: granted)
                }
            }
        }
        if isAuthorized {
            await fetchEvents()
        }
        return isAuthorized
    }

    /// Re-checks authorization status without showing a dialog. Use when app becomes active
    /// (e.g. user granted permission in System Settings and returned to the app).
    func refreshAuthorizationStatus() async {
        let status = EKEventStore.authorizationStatus(for: .event)
        let granted: Bool
        if #available(macOS 14.0, *) {
            granted = status == .fullAccess
        } else {
            granted = status == .authorized
        }
        if granted != isAuthorized {
            isAuthorized = granted
            if granted {
                await fetchEvents()
            } else {
                events = []
            }
        } else if granted {
            await fetchEvents()
        }
    }

    func fetchEvents() async {
        guard isAuthorized else { return }
        let allCalendars = store.calendars(for: .event)
        let calendars = allCalendars.filter { $0.title != blockingCalendarTitle }
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .day, value: 7, to: start) ?? start
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
        events = store.events(matching: predicate)
    }

    func events(for date: Date) -> [EKEvent] {
        let cal = Calendar.current
        return events.filter { cal.isDate($0.startDate, inSameDayAs: date) }
    }

    private func blockingCalendar() -> EKCalendar? {
        return store.calendars(for: .event).first { $0.title == blockingCalendarTitle }
            ?? createBlockingCalendar()
    }

    private func createBlockingCalendar() -> EKCalendar? {
        guard let localSource = store.sources.first(where: { $0.sourceType == .local }) else { return nil }
        let cal = EKCalendar(for: .event, eventStore: store)
        cal.title = blockingCalendarTitle
        cal.source = localSource
        cal.cgColor = CGColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1)
        do {
            try store.saveCalendar(cal, commit: true)
            return cal
        } catch {
            return nil
        }
    }

    func createBlockingEvent(for todo: TodoItem) -> String? {
        guard isAuthorized,
              let start = todo.scheduledStart,
              let duration = todo.durationMinutes,
              let calendar = blockingCalendar() else { return nil }
        let event = EKEvent(eventStore: store)
        event.calendar = calendar
        event.title = todo.title
        event.startDate = start
        event.endDate = start.addingTimeInterval(TimeInterval(duration * 60))
        event.isAllDay = false
        do {
            try store.save(event, span: .thisEvent)
            return event.eventIdentifier
        } catch {
            return nil
        }
    }

    func updateBlockingEvent(for todo: TodoItem) {
        guard isAuthorized,
              let id = todo.calendarEventIdentifier,
              let event = store.event(withIdentifier: id),
              let start = todo.scheduledStart,
              let duration = todo.durationMinutes else { return }
        event.title = todo.title
        event.startDate = start
        event.endDate = start.addingTimeInterval(TimeInterval(duration * 60))
        do {
            try store.save(event, span: .thisEvent)
        } catch {}
    }

    func deleteBlockingEvent(identifier: String) {
        guard isAuthorized, let event = store.event(withIdentifier: identifier) else { return }
        do {
            try store.remove(event, span: .thisEvent)
        } catch {}
    }

    func updateEvent(
        eventIdentifier: String,
        title: String,
        startDate: Date,
        endDate: Date,
        isAllDay: Bool,
        location: String?,
        notes: String?
    ) throws {
        guard isAuthorized else {
            throw CalendarServiceEditError.unauthorized
        }
        guard let event = store.event(withIdentifier: eventIdentifier) else {
            throw CalendarServiceEditError.eventNotFound
        }

        event.title = title
        event.startDate = startDate
        event.endDate = endDate
        event.isAllDay = isAllDay
        event.location = location
        event.notes = notes

        do {
            try store.save(event, span: .thisEvent)
            Task { await self.fetchEvents() }
        } catch {
            throw CalendarServiceEditError.saveFailed
        }
    }
}
