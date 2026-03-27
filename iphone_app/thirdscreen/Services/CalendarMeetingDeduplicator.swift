//
//  CalendarMeetingDeduplicator.swift
//  thirdscreen
//

import Foundation

enum CalendarMeetingDeduplicator {
    static func dedupe(_ items: [ScheduleItem]) -> [ScheduleItem] {
        var keyed: [String: ScheduleItem] = [:]
        var passthrough: [ScheduleItem] = []

        for item in items {
            guard item.source == .calendar,
                  let joinInfo = item.joinInfo else {
                passthrough.append(item)
                continue
            }

            let key = "\(joinInfo.normalizedKey)|\(startMinuteKey(for: item.startDate))"
            if let existing = keyed[key] {
                keyed[key] = preferred(existing, over: item)
            } else {
                keyed[key] = item
            }
        }

        let dedupedCalendars = keyed.values
        let merged = passthrough + dedupedCalendars
        return merged.sorted { lhs, rhs in
            if lhs.startDate != rhs.startDate {
                return lhs.startDate < rhs.startDate
            }
            return lhs.id < rhs.id
        }
    }

    static func preferred(_ lhs: ScheduleItem, over rhs: ScheduleItem) -> ScheduleItem {
        let lhsRank = ranking(lhs)
        let rhsRank = ranking(rhs)
        if lhsRank != rhsRank {
            return lhsRank > rhsRank ? lhs : rhs
        }
        return lhs.id <= rhs.id ? lhs : rhs
    }

    private static func ranking(_ item: ScheduleItem) -> (Int, Int, Int) {
        let specificity = (item.joinInfo?.provider == .generic || item.joinInfo == nil) ? 0 : 1
        let originRank: Int
        switch item.calendarOrigin {
        case .google:
            originRank = 2
        case .apple:
            originRank = 1
        default:
            originRank = 0
        }

        let titleLength = item.title.trimmingCharacters(in: .whitespacesAndNewlines).count
        return (specificity, originRank, titleLength)
    }

    private static func startMinuteKey(for date: Date) -> Int64 {
        Int64(date.timeIntervalSince1970 / 60.0)
    }
}
