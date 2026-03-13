import Foundation

@Observable
final class CalorieStore {
    private(set) var foodItems: [FoodItem] = []
    private(set) var waterLogs: [WaterLog] = []
    var config: CalorieConfig

    private let instanceID: UUID
    private let localFoodKey: String
    private let localWaterKey: String
    private let localConfigKey: String
    private var saveTask: Task<Void, Never>?

    init(instanceID: UUID) {
        self.instanceID = instanceID
        self.localFoodKey = "thirdscreen.food.\(instanceID.uuidString)"
        self.localWaterKey = "thirdscreen.water.\(instanceID.uuidString)"
        self.localConfigKey = "thirdscreen.calorieConfig.\(instanceID.uuidString)"
        self.config = .default
        loadConfig()
        loadFoodItems()
        loadWaterLogs()
    }

    // MARK: - Food Items

    func foodItems(for date: Date) -> [FoodItem] {
        let dayStart = Calendar.current.startOfDay(for: date)
        return foodItems.filter { Calendar.current.startOfDay(for: $0.date) == dayStart }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func totalCalories(for date: Date) -> Int {
        foodItems(for: date).reduce(0) { $0 + $1.calories }
    }

    @discardableResult
    func addFood(name: String, calories: Int, date: Date = Date()) -> FoodItem {
        let item = FoodItem(name: name, calories: calories, date: Calendar.current.startOfDay(for: date))
        foodItems.insert(item, at: 0)
        saveFoodItems()
        return item
    }

    func deleteFood(_ item: FoodItem) {
        foodItems.removeAll { $0.id == item.id }
        saveFoodItems()
    }

    func updateFood(_ item: FoodItem) {
        if let idx = foodItems.firstIndex(where: { $0.id == item.id }) {
            foodItems[idx] = item
            scheduleSave()
        }
    }

    // MARK: - Water Tracking

    func waterConsumed(for date: Date) -> Int {
        let dayStart = Calendar.current.startOfDay(for: date)
        return waterLogs.first { $0.date == dayStart }?.mlConsumed ?? 0
    }

    func addWater(_ ml: Int, for date: Date = Date()) {
        let dayStart = Calendar.current.startOfDay(for: date)
        if let idx = waterLogs.firstIndex(where: { $0.date == dayStart }) {
            waterLogs[idx].mlConsumed = max(0, waterLogs[idx].mlConsumed + ml)
        } else {
            waterLogs.append(WaterLog(date: dayStart, mlConsumed: max(0, ml)))
        }
        saveWaterLogs()
    }

    func setWater(_ ml: Int, for date: Date = Date()) {
        let dayStart = Calendar.current.startOfDay(for: date)
        if let idx = waterLogs.firstIndex(where: { $0.date == dayStart }) {
            waterLogs[idx].mlConsumed = max(0, ml)
        } else {
            waterLogs.append(WaterLog(date: dayStart, mlConsumed: max(0, ml)))
        }
        saveWaterLogs()
    }

    func waterProgress(for date: Date) -> Double {
        guard config.dailyWaterGoalML > 0 else { return 0 }
        return min(1.0, Double(waterConsumed(for: date)) / Double(config.dailyWaterGoalML))
    }

    // MARK: - Config

    func updateConfig(_ newConfig: CalorieConfig) {
        config = newConfig
        saveConfig()
    }

    // MARK: - Persistence

    private func loadFoodItems() {
        guard let data = UserDefaults.standard.data(forKey: localFoodKey),
              let decoded = try? JSONDecoder().decode([FoodItem].self, from: data) else {
            foodItems = []
            return
        }
        foodItems = decoded
    }

    private func saveFoodItems() {
        guard let data = try? JSONEncoder().encode(foodItems) else { return }
        UserDefaults.standard.set(data, forKey: localFoodKey)
    }

    private func loadWaterLogs() {
        guard let data = UserDefaults.standard.data(forKey: localWaterKey),
              let decoded = try? JSONDecoder().decode([WaterLog].self, from: data) else {
            waterLogs = []
            return
        }
        waterLogs = decoded
    }

    private func saveWaterLogs() {
        guard let data = try? JSONEncoder().encode(waterLogs) else { return }
        UserDefaults.standard.set(data, forKey: localWaterKey)
    }

    private func loadConfig() {
        guard let data = UserDefaults.standard.data(forKey: localConfigKey),
              let decoded = try? JSONDecoder().decode(CalorieConfig.self, from: data) else {
            config = .default
            return
        }
        config = decoded
    }

    private func saveConfig() {
        guard let data = try? JSONEncoder().encode(config) else { return }
        UserDefaults.standard.set(data, forKey: localConfigKey)
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self.saveFoodItems()
        }
    }
}
