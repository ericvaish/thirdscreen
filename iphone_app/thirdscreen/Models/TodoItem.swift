//
//  TodoItem.swift
//  thirdscreen
//

import Foundation

struct TodoItem: Identifiable, Codable, Equatable {
    var id: UUID
    var title: String
    var isCompleted: Bool
    var scheduledStart: Date?
    var durationMinutes: Int?
    var calendarEventIdentifier: String?
    var reminderIdentifier: String?
    var createdAt: Date

    init(
        id: UUID = UUID(),
        title: String,
        isCompleted: Bool = false,
        scheduledStart: Date? = nil,
        durationMinutes: Int? = nil,
        calendarEventIdentifier: String? = nil,
        reminderIdentifier: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.isCompleted = isCompleted
        self.scheduledStart = scheduledStart
        self.durationMinutes = durationMinutes
        self.calendarEventIdentifier = calendarEventIdentifier
        self.reminderIdentifier = reminderIdentifier
        self.createdAt = createdAt
    }

    var endDate: Date? {
        guard let start = scheduledStart, let duration = durationMinutes else { return nil }
        return start.addingTimeInterval(TimeInterval(duration * 60))
    }
}
