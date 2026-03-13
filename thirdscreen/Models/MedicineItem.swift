import Foundation

enum MedicineRepeatPattern: String, Codable, CaseIterable {
    case daily
    case weekly
    case custom

    var label: String {
        switch self {
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .custom: return "Custom"
        }
    }
}

struct MedicineTime: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var hour: Int
    var minute: Int

    init(id: UUID = UUID(), hour: Int = 8, minute: Int = 0) {
        self.id = id
        self.hour = hour
        self.minute = minute
    }

    var displayString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let date = Calendar.current.date(from: components) ?? Date()
        return formatter.string(from: date)
    }

    var asDate: Date {
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        return Calendar.current.date(from: components) ?? Date()
    }
}

struct MedicineItem: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var name: String
    var dosage: String
    var times: [MedicineTime]
    var repeatPattern: MedicineRepeatPattern
    /// 7 bools: index 0 = Sunday, 1 = Monday, ... 6 = Saturday
    var activeDays: [Bool]
    var isActive: Bool
    var createdAt: Date
    var modifiedAt: Date

    init(
        id: UUID = UUID(),
        name: String = "",
        dosage: String = "",
        times: [MedicineTime] = [MedicineTime()],
        repeatPattern: MedicineRepeatPattern = .daily,
        activeDays: [Bool] = Array(repeating: true, count: 7),
        isActive: Bool = true,
        createdAt: Date = Date(),
        modifiedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.dosage = dosage
        self.times = times
        self.repeatPattern = repeatPattern
        self.activeDays = activeDays.count == 7 ? activeDays : Array(repeating: true, count: 7)
        self.isActive = isActive
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
    }

    static let dayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    static let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]

    var activeDaySummary: String {
        if activeDays.allSatisfy({ $0 }) { return "Every day" }
        let names = activeDays.enumerated().compactMap { idx, on in
            on ? Self.dayAbbreviations[idx] : nil
        }
        return names.joined(separator: ", ")
    }

    func isScheduledToday() -> Bool {
        isScheduled(for: Date())
    }

    func isScheduled(for date: Date) -> Bool {
        let weekday = Calendar.current.component(.weekday, from: date) - 1 // 0=Sun
        return isActive && activeDays.indices.contains(weekday) && activeDays[weekday]
    }
}

// MARK: - Dose Log

struct MedicineDoseLog: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var medicineID: UUID
    var timeID: UUID
    var takenAt: Date
    /// The calendar date this dose was scheduled for (start of day)
    var scheduledDate: Date

    init(
        id: UUID = UUID(),
        medicineID: UUID,
        timeID: UUID,
        takenAt: Date = Date(),
        scheduledDate: Date = Calendar.current.startOfDay(for: Date())
    ) {
        self.id = id
        self.medicineID = medicineID
        self.timeID = timeID
        self.takenAt = takenAt
        self.scheduledDate = scheduledDate
    }
}
