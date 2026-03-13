import Foundation
import UserNotifications
import Combine

@Observable
final class MedicineStore {
    private(set) var medicines: [MedicineItem] = []
    private(set) var doseLogs: [MedicineDoseLog] = []

    private let instanceID: UUID
    private let localMedsKey: String
    private let localLogsKey: String
    private var saveTask: Task<Void, Never>?
    private var metadataQuery: NSMetadataQuery?
    private var queryObservers: [NSObjectProtocol] = []

    init(instanceID: UUID) {
        self.instanceID = instanceID
        self.localMedsKey = "thirdscreen.medicines.\(instanceID.uuidString)"
        self.localLogsKey = "thirdscreen.medicineLogs.\(instanceID.uuidString)"
        loadMedicines()
        loadDoseLogs()
        startICloudMonitor()
        requestNotificationPermission()
    }

    deinit {
        metadataQuery?.stop()
        for observer in queryObservers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    func sortedMedicines() -> [MedicineItem] {
        medicines.sorted { lhs, rhs in
            if lhs.isActive != rhs.isActive { return lhs.isActive }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    func todaysMedicines() -> [MedicineItem] {
        medicines.filter { $0.isScheduledToday() }
    }

    func medicines(for date: Date) -> [MedicineItem] {
        medicines.filter { $0.isScheduled(for: date) }
    }

    func completionCount(for medicine: MedicineItem, on date: Date) -> Int {
        let dayStart = Calendar.current.startOfDay(for: date)
        return medicine.times.filter { time in
            doseLogs.contains { $0.medicineID == medicine.id && $0.timeID == time.id && $0.scheduledDate == dayStart }
        }.count
    }

    @discardableResult
    func addMedicine(name: String = "", dosage: String = "") -> MedicineItem {
        var med = MedicineItem()
        med.name = name
        med.dosage = dosage
        medicines.insert(med, at: 0)
        saveMedicine(med)
        scheduleReminders(for: med)
        return med
    }

    func update(_ medicine: MedicineItem) {
        var updated = medicine
        updated.modifiedAt = Date()
        if let idx = medicines.firstIndex(where: { $0.id == updated.id }) {
            medicines[idx] = updated
            scheduleSaveMedicine(updated)
            scheduleReminders(for: updated)
        }
    }

    func delete(_ medicine: MedicineItem) {
        medicines.removeAll { $0.id == medicine.id }
        doseLogs.removeAll { $0.medicineID == medicine.id }
        deleteMedicinePersistence(medicine.id)
        cancelReminders(for: medicine.id)
        saveLocalDoseLogs()
        saveICloudDoseLogs()
    }

    func toggleActive(_ medicine: MedicineItem) {
        var updated = medicine
        updated.isActive.toggle()
        updated.modifiedAt = Date()
        update(updated)
    }

    // MARK: - Dose Tracking

    func isDoseTaken(medicineID: UUID, timeID: UUID, date: Date = Date()) -> Bool {
        let dayStart = Calendar.current.startOfDay(for: date)
        return doseLogs.contains { log in
            log.medicineID == medicineID && log.timeID == timeID && log.scheduledDate == dayStart
        }
    }

    func markDoseTaken(medicineID: UUID, timeID: UUID, date: Date = Date()) {
        let dayStart = Calendar.current.startOfDay(for: date)
        guard !isDoseTaken(medicineID: medicineID, timeID: timeID, date: date) else { return }
        let log = MedicineDoseLog(medicineID: medicineID, timeID: timeID, scheduledDate: dayStart)
        doseLogs.append(log)
        saveLocalDoseLogs()
        saveICloudDoseLogs()
    }

    func unmarkDose(medicineID: UUID, timeID: UUID, date: Date = Date()) {
        let dayStart = Calendar.current.startOfDay(for: date)
        doseLogs.removeAll { log in
            log.medicineID == medicineID && log.timeID == timeID && log.scheduledDate == dayStart
        }
        saveLocalDoseLogs()
        saveICloudDoseLogs()
    }

    func todayCompletionCount(for medicine: MedicineItem) -> Int {
        let today = Calendar.current.startOfDay(for: Date())
        return medicine.times.filter { time in
            doseLogs.contains { $0.medicineID == medicine.id && $0.timeID == time.id && $0.scheduledDate == today }
        }.count
    }

    // MARK: - Notifications

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    func scheduleReminders(for medicine: MedicineItem) {
        cancelReminders(for: medicine.id)
        guard medicine.isActive else { return }

        let center = UNUserNotificationCenter.current()
        for time in medicine.times {
            for (dayIndex, isOn) in medicine.activeDays.enumerated() {
                guard isOn else { continue }
                let content = UNMutableNotificationContent()
                content.title = "Medicine Reminder"
                content.body = medicine.dosage.isEmpty
                    ? "Time to take \(medicine.name)"
                    : "Time to take \(medicine.name) (\(medicine.dosage))"
                content.sound = .default
                content.categoryIdentifier = "MEDICINE_REMINDER"

                var dateComponents = DateComponents()
                dateComponents.weekday = dayIndex + 1 // 1=Sunday
                dateComponents.hour = time.hour
                dateComponents.minute = time.minute

                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
                let identifier = reminderID(medicineID: medicine.id, timeID: time.id, day: dayIndex)
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
                center.add(request)
            }
        }
    }

    func scheduleAllReminders() {
        for med in medicines {
            scheduleReminders(for: med)
        }
    }

    private func cancelReminders(for medicineID: UUID) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            let prefix = "med_\(medicineID.uuidString)"
            let ids = requests.filter { $0.identifier.hasPrefix(prefix) }.map(\.identifier)
            center.removePendingNotificationRequests(withIdentifiers: ids)
        }
    }

    private func reminderID(medicineID: UUID, timeID: UUID, day: Int) -> String {
        "med_\(medicineID.uuidString)_\(timeID.uuidString)_\(day)"
    }

    // MARK: - Unified Load/Save

    private func loadMedicines() {
        loadLocalMedicines()
        let icloudMeds = loadICloudMedicinesArray()
        mergeMedicines(icloudMeds)
    }

    private func loadDoseLogs() {
        loadLocalDoseLogs()
        let icloudLogs = loadICloudDoseLogsArray()
        mergeDoseLogs(icloudLogs)
    }

    private func saveMedicine(_ medicine: MedicineItem) {
        saveLocalMedicines()
        saveICloudMedicine(medicine)
    }

    private func scheduleSaveMedicine(_ medicine: MedicineItem) {
        saveTask?.cancel()
        saveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self.saveLocalMedicines()
            self.saveICloudMedicine(medicine)
        }
    }

    private func deleteMedicinePersistence(_ medicineID: UUID) {
        saveLocalMedicines()
        deleteICloudMedicine(medicineID)
    }

    // MARK: - Local Persistence

    private func loadLocalMedicines() {
        guard let data = UserDefaults.standard.data(forKey: localMedsKey),
              let decoded = try? JSONDecoder().decode([MedicineItem].self, from: data) else {
            medicines = []
            return
        }
        medicines = decoded
    }

    private func saveLocalMedicines() {
        guard let data = try? JSONEncoder().encode(medicines) else { return }
        UserDefaults.standard.set(data, forKey: localMedsKey)
    }

    private func loadLocalDoseLogs() {
        guard let data = UserDefaults.standard.data(forKey: localLogsKey),
              let decoded = try? JSONDecoder().decode([MedicineDoseLog].self, from: data) else {
            doseLogs = []
            return
        }
        doseLogs = decoded
    }

    private func saveLocalDoseLogs() {
        guard let data = try? JSONEncoder().encode(doseLogs) else { return }
        UserDefaults.standard.set(data, forKey: localLogsKey)
    }

    // MARK: - iCloud Persistence

    private var icloudMedicinesDirectory: URL? {
        guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
        let dir = container.appendingPathComponent("Documents/medicines/\(instanceID.uuidString)", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private var icloudDoseLogsFile: URL? {
        guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
        let dir = container.appendingPathComponent("Documents/medicineLogs/\(instanceID.uuidString)", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir.appendingPathComponent("doseLogs.json")
    }

    private func icloudFileURL(for medicineID: UUID) -> URL? {
        icloudMedicinesDirectory?.appendingPathComponent("\(medicineID.uuidString).json")
    }

    private func saveICloudMedicine(_ medicine: MedicineItem) {
        guard let url = icloudFileURL(for: medicine.id) else { return }
        guard let data = try? JSONEncoder().encode(medicine) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func deleteICloudMedicine(_ medicineID: UUID) {
        guard let url = icloudFileURL(for: medicineID) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func loadICloudMedicinesArray() -> [MedicineItem] {
        guard let dir = icloudMedicinesDirectory else { return [] }
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return [] }
        let decoder = JSONDecoder()
        var loaded: [MedicineItem] = []
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let med = try? decoder.decode(MedicineItem.self, from: data) else { continue }
            loaded.append(med)
        }
        return loaded
    }

    private func saveICloudDoseLogs() {
        guard let url = icloudDoseLogsFile else { return }
        guard let data = try? JSONEncoder().encode(doseLogs) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func loadICloudDoseLogsArray() -> [MedicineDoseLog] {
        guard let url = icloudDoseLogsFile,
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([MedicineDoseLog].self, from: data) else { return [] }
        return decoded
    }

    // MARK: - Merge

    private func mergeMedicines(_ remote: [MedicineItem]) {
        for remoteMed in remote {
            if let idx = medicines.firstIndex(where: { $0.id == remoteMed.id }) {
                if remoteMed.modifiedAt > medicines[idx].modifiedAt {
                    medicines[idx] = remoteMed
                }
            } else {
                medicines.append(remoteMed)
            }
        }
    }

    private func mergeDoseLogs(_ remote: [MedicineDoseLog]) {
        for log in remote {
            if !doseLogs.contains(where: { $0.id == log.id }) {
                doseLogs.append(log)
            }
        }
    }

    // MARK: - iCloud Monitor

    private func startICloudMonitor() {
        guard icloudMedicinesDirectory != nil else { return }
        let query = NSMetadataQuery()
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
        query.predicate = NSPredicate(format: "%K LIKE '*.json'", NSMetadataItemFSNameKey)

        let gathered = NotificationCenter.default.addObserver(
            forName: .NSMetadataQueryDidFinishGathering,
            object: query,
            queue: .main
        ) { [weak self] _ in
            self?.handleICloudUpdate()
        }

        let updated = NotificationCenter.default.addObserver(
            forName: .NSMetadataQueryDidUpdate,
            object: query,
            queue: .main
        ) { [weak self] _ in
            self?.handleICloudUpdate()
        }

        queryObservers = [gathered, updated]
        metadataQuery = query
        query.start()
    }

    private func handleICloudUpdate() {
        let remoteMeds = loadICloudMedicinesArray()
        mergeMedicines(remoteMeds)
        saveLocalMedicines()

        let remoteLogs = loadICloudDoseLogsArray()
        mergeDoseLogs(remoteLogs)
        saveLocalDoseLogs()
    }
}
