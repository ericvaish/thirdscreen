//
//  ScheduleItem.swift
//  thirdscreen
//

import Foundation

enum ScheduleItemSource {
    case calendar
    case todo
}

enum CalendarOrigin: String {
    case apple
    case google
    case todo
}

struct ScheduleItem: Identifiable {
    let id: String
    let title: String
    let startDate: Date
    let endDate: Date
    let source: ScheduleItemSource
    let color: String?
    let joinInfo: MeetingJoinInfo?
    let calendarOrigin: CalendarOrigin?
    let location: String?
    let notes: String?
    let calendarName: String?
    let organizer: String?
    let attendees: [String]
    let eventURL: URL?
    let status: String?
    let isAllDay: Bool

    init(
        id: String,
        title: String,
        startDate: Date,
        endDate: Date,
        source: ScheduleItemSource,
        color: String? = nil,
        joinInfo: MeetingJoinInfo? = nil,
        calendarOrigin: CalendarOrigin? = nil,
        location: String? = nil,
        notes: String? = nil,
        calendarName: String? = nil,
        organizer: String? = nil,
        attendees: [String] = [],
        eventURL: URL? = nil,
        status: String? = nil,
        isAllDay: Bool = false
    ) {
        self.id = id
        self.title = title
        self.startDate = startDate
        self.endDate = endDate
        self.source = source
        self.color = color
        self.joinInfo = joinInfo
        self.calendarOrigin = calendarOrigin
        self.location = location
        self.notes = notes
        self.calendarName = calendarName
        self.organizer = organizer
        self.attendees = attendees
        self.eventURL = eventURL
        self.status = status
        self.isAllDay = isAllDay
    }
}
