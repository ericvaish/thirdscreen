import Foundation

struct FoodItem: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var name: String
    var calories: Int
    var date: Date
    var createdAt: Date

    init(
        id: UUID = UUID(),
        name: String = "",
        calories: Int = 0,
        date: Date = Calendar.current.startOfDay(for: Date()),
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.calories = calories
        self.date = date
        self.createdAt = createdAt
    }
}

struct WaterLog: Codable, Equatable {
    var date: Date
    var mlConsumed: Int

    init(date: Date = Calendar.current.startOfDay(for: Date()), mlConsumed: Int = 0) {
        self.date = date
        self.mlConsumed = mlConsumed
    }
}

struct CalorieConfig: Codable, Equatable {
    var dailyCalorieGoal: Int
    var dailyWaterGoalML: Int

    init(dailyCalorieGoal: Int = 2000, dailyWaterGoalML: Int = 3000) {
        self.dailyCalorieGoal = dailyCalorieGoal
        self.dailyWaterGoalML = dailyWaterGoalML
    }

    static var `default`: CalorieConfig { CalorieConfig() }

    var waterGoalLiters: Double {
        Double(dailyWaterGoalML) / 1000.0
    }
}
