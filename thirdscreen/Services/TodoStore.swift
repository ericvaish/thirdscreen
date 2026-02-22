//
//  TodoStore.swift
//  thirdscreen
//

import Foundation
import SwiftUI

@Observable
final class TodoStore {
    var items: [TodoItem] = []
    private let key = "thirdscreen.todos"
    private weak var calendarService: CalendarService?
    private weak var reminderService: ReminderService?
    private var isMergingFromReminders = false

    init(calendarService: CalendarService? = nil, reminderService: ReminderService? = nil) {
        self.calendarService = calendarService
        self.reminderService = reminderService
        load()
        self.reminderService?.onRemindersChanged = { [weak self] reminders in
            guard let self else { return }
            self.mergeFromReminders(reminders)
            self.ensureRemindersForLocalItems()
        }
    }

    deinit {
        reminderService?.onRemindersChanged = nil
    }

    func refreshReminderSyncFromService() {
        guard let reminderService, reminderService.isAuthorized else { return }
        ensureRemindersForLocalItems()
        guard reminderService.hasLoadedReminders else { return }
        mergeFromReminders(reminderService.reminders)
    }

    func add(_ item: TodoItem) {
        var mutable = item
        rebuildCalendarEvent(for: &mutable, oldIdentifier: nil)
        syncReminder(for: &mutable)
        items.append(mutable)
        save()
    }

    func remove(_ item: TodoItem) {
        deleteCalendarEvent(withIdentifier: item.calendarEventIdentifier)
        deleteReminder(withIdentifier: item.reminderIdentifier)
        items.removeAll { $0.id == item.id }
        save()
    }

    func toggle(_ item: TodoItem) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            var mutable = items[idx]
            mutable.isCompleted.toggle()
            rebuildCalendarEvent(for: &mutable, oldIdentifier: items[idx].calendarEventIdentifier)
            syncReminder(for: &mutable)
            items[idx] = mutable
            save()
        }
    }

    func update(_ item: TodoItem) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            var mutable = item
            mutable.reminderIdentifier = items[idx].reminderIdentifier ?? item.reminderIdentifier
            rebuildCalendarEvent(for: &mutable, oldIdentifier: items[idx].calendarEventIdentifier)
            syncReminder(for: &mutable)
            items[idx] = mutable
            save()
        }
    }

    private func ensureRemindersForLocalItems() {
        guard let reminderService, reminderService.isAuthorized else { return }

        var changed = false
        for index in items.indices {
            if items[index].reminderIdentifier == nil,
               let reminderIdentifier = reminderService.createReminder(for: items[index]) {
                items[index].reminderIdentifier = reminderIdentifier
                changed = true
            }
        }

        if changed {
            save()
        }
    }

    private func mergeFromReminders(_ reminders: [ReminderSnapshot]) {
        guard let reminderService, reminderService.isAuthorized else { return }
        guard !isMergingFromReminders else { return }

        isMergingFromReminders = true
        defer { isMergingFromReminders = false }

        var nextItems = items
        var changed = false
        let remindersByIdentifier = Dictionary(uniqueKeysWithValues: reminders.map { ($0.id, $0) })

        for index in nextItems.indices {
            guard let reminderIdentifier = nextItems[index].reminderIdentifier,
                  let snapshot = remindersByIdentifier[reminderIdentifier]
            else { continue }

            let oldValue = nextItems[index]
            var merged = oldValue
            apply(snapshot: snapshot, to: &merged)

            if hasCalendarRelevantChanges(from: oldValue, to: merged) {
                rebuildCalendarEvent(for: &merged, oldIdentifier: oldValue.calendarEventIdentifier)
            } else {
                merged.calendarEventIdentifier = oldValue.calendarEventIdentifier
            }

            if merged != oldValue {
                nextItems[index] = merged
                changed = true
            }
        }

        for index in nextItems.indices.reversed() {
            guard let reminderIdentifier = nextItems[index].reminderIdentifier,
                  remindersByIdentifier[reminderIdentifier] == nil,
                  !reminderService.reminderExists(identifier: reminderIdentifier)
            else { continue }

            deleteCalendarEvent(withIdentifier: nextItems[index].calendarEventIdentifier)
            nextItems.remove(at: index)
            changed = true
        }

        let existingReminderIdentifiers = Set(nextItems.compactMap(\.reminderIdentifier))
        for snapshot in reminders where !existingReminderIdentifiers.contains(snapshot.id) {
            var newItem = TodoItem(
                title: snapshot.title,
                isCompleted: snapshot.isCompleted,
                scheduledStart: snapshot.dueDate,
                durationMinutes: snapshot.dueDate == nil ? nil : 30,
                calendarEventIdentifier: nil,
                reminderIdentifier: snapshot.id,
                createdAt: snapshot.createdAt ?? Date()
            )
            rebuildCalendarEvent(for: &newItem, oldIdentifier: nil)
            nextItems.append(newItem)
            changed = true
        }

        if changed {
            items = nextItems
            save()
        }
    }

    private func apply(snapshot: ReminderSnapshot, to item: inout TodoItem) {
        item.title = snapshot.title
        item.isCompleted = snapshot.isCompleted
        item.reminderIdentifier = snapshot.id
        if let dueDate = snapshot.dueDate {
            item.scheduledStart = dueDate
            if item.durationMinutes == nil {
                item.durationMinutes = 30
            }
        } else {
            item.scheduledStart = nil
            item.durationMinutes = nil
        }
    }

    private func hasCalendarRelevantChanges(from oldValue: TodoItem, to newValue: TodoItem) -> Bool {
        oldValue.title != newValue.title ||
            oldValue.isCompleted != newValue.isCompleted ||
            oldValue.scheduledStart != newValue.scheduledStart ||
            oldValue.durationMinutes != newValue.durationMinutes
    }

    private func rebuildCalendarEvent(for item: inout TodoItem, oldIdentifier: String?) {
        deleteCalendarEvent(withIdentifier: oldIdentifier)
        item.calendarEventIdentifier = nil

        guard !item.isCompleted,
              item.scheduledStart != nil,
              item.durationMinutes != nil,
              let calendarService
        else { return }

        if let eventIdentifier = calendarService.createBlockingEvent(for: item) {
            item.calendarEventIdentifier = eventIdentifier
        }
    }

    private func deleteCalendarEvent(withIdentifier identifier: String?) {
        guard let identifier else { return }
        calendarService?.deleteBlockingEvent(identifier: identifier)
    }

    private func syncReminder(for item: inout TodoItem) {
        guard !isMergingFromReminders,
              let reminderService,
              reminderService.isAuthorized
        else { return }

        if let reminderIdentifier = item.reminderIdentifier {
            let updated = reminderService.updateReminder(identifier: reminderIdentifier, from: item)
            if !updated {
                item.reminderIdentifier = reminderService.createReminder(for: item)
            }
        } else {
            item.reminderIdentifier = reminderService.createReminder(for: item)
        }
    }

    private func deleteReminder(withIdentifier identifier: String?) {
        guard !isMergingFromReminders, let identifier else { return }
        reminderService?.deleteReminder(identifier: identifier)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([TodoItem].self, from: data) else { return }
        items = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
