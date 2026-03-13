import SwiftUI

struct CalorieCardView: View {
    @Bindable var calorieStore: CalorieStore
    @State private var selectedDate: Date = Date()
    @State private var weekOffset: Int = 0
    @State private var showAddSheet = false
    @State private var showSettingsSheet = false

    var body: some View {
        VStack(spacing: 0) {
            dateSelector
            Divider().padding(.horizontal, 10)
            summaryBar
            Divider().padding(.horizontal, 10)

            ScrollView {
                VStack(spacing: 12) {
                    waterSection
                    foodListSection
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .sheet(isPresented: $showAddSheet) {
            AddFoodSheet(calorieStore: calorieStore, date: selectedDate) {
                showAddSheet = false
            }
        }
        .sheet(isPresented: $showSettingsSheet) {
            CalorieSettingsSheet(calorieStore: calorieStore) {
                showSettingsSheet = false
            }
        }
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        WeekStripView(selectedDate: $selectedDate, weekOffset: $weekOffset) {
            Button {
                showSettingsSheet = true
            } label: {
                Image(systemName: "gearshape")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help("Food & water goals")
            Button {
                showAddSheet = true
            } label: {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help("Add food item")
        }
    }

    // MARK: - Summary Bar

    private var summaryBar: some View {
        let consumed = calorieStore.totalCalories(for: selectedDate)
        let goal = calorieStore.config.dailyCalorieGoal
        let remaining = max(0, goal - consumed)
        let progress = goal > 0 ? min(1.0, Double(consumed) / Double(goal)) : 0
        let isOver = consumed > goal

        return VStack(spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(consumed)")
                        .appScaledSystemFont(size: 20, weight: .bold)
                        .foregroundStyle(isOver ? .red : .primary)
                    Text("of \(goal) kcal")
                        .appScaledSystemFont(size: 10)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(isOver ? "+\(consumed - goal)" : "\(remaining)")
                        .appScaledSystemFont(size: 16, weight: .semibold)
                        .foregroundStyle(isOver ? .red : .green)
                    Text(isOver ? "over" : "remaining")
                        .appScaledSystemFont(size: 10)
                        .foregroundStyle(.secondary)
                }
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.primary.opacity(0.08))
                        .frame(height: 6)
                    Capsule()
                        .fill(isOver ? Color.red : Color.green)
                        .frame(width: geo.size.width * progress, height: 6)
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    // MARK: - Water Section

    private var waterSection: some View {
        let consumed = calorieStore.waterConsumed(for: selectedDate)
        let goalML = calorieStore.config.dailyWaterGoalML
        let progress = calorieStore.waterProgress(for: selectedDate)
        let litersConsumed = Double(consumed) / 1000.0
        let litersGoal = Double(goalML) / 1000.0

        return VStack(spacing: 8) {
            HStack {
                Image(systemName: "drop.fill")
                    .foregroundStyle(.cyan)
                    .appScaledSystemFont(size: 13)
                Text("Water")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(String(format: "%.1fL / %.1fL", litersConsumed, litersGoal))
                    .appScaledSystemFont(size: 11)
                    .foregroundStyle(.secondary)
            }

            // Water progress visualization
            HStack(spacing: 3) {
                // 8 glass segments
                let glasses = 8
                let filledGlasses = Int(Double(glasses) * progress)
                ForEach(0..<glasses, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(i < filledGlasses ? Color.cyan : Color.cyan.opacity(0.15))
                        .frame(height: 20)
                }
            }

            HStack(spacing: 8) {
                waterButton(ml: 250, label: "250ml")
                waterButton(ml: 500, label: "500ml")
                waterButton(ml: -250, label: "-250ml")
            }
        }
        .padding(10)
        .background(.quaternary.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
    }

    private func waterButton(ml: Int, label: String) -> some View {
        Button {
            calorieStore.addWater(ml, for: selectedDate)
        } label: {
            Text(label)
                .appScaledSystemFont(size: 10, weight: .medium)
                .foregroundStyle(ml > 0 ? .cyan : .secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(ml > 0 ? Color.cyan.opacity(0.12) : Color.secondary.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Food List

    private var foodListSection: some View {
        let items = calorieStore.foodItems(for: selectedDate)

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Food Log")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(items.count) items")
                    .appScaledSystemFont(size: 10)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 4)

            if items.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "fork.knife")
                            .appScaledSystemFont(size: 20)
                            .foregroundStyle(.tertiary)
                        Text("No food logged")
                            .appScaledSystemFont(size: 12)
                            .foregroundStyle(.tertiary)
                        Button("Add Food") {
                            showAddSheet = true
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                    Spacer()
                }
                .padding(.vertical, 16)
            } else {
                ForEach(items) { item in
                    foodRow(item)
                }
            }
        }
    }

    private func foodRow(_ item: FoodItem) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name.isEmpty ? "Untitled" : item.name)
                    .appScaledSystemFont(size: 13, weight: .medium)
                Text("\(item.calories) kcal")
                    .appScaledSystemFont(size: 11)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(item.calories)")
                .appScaledSystemFont(size: 14, weight: .semibold)
                .foregroundStyle(.orange)
        }
        .padding(.vertical, 5)
        .padding(.horizontal, 8)
        .background(.quaternary.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
        .contextMenu {
            Button("Delete", role: .destructive) {
                calorieStore.deleteFood(item)
            }
        }
    }
}

// MARK: - Add Food Sheet

struct AddFoodSheet: View {
    @Bindable var calorieStore: CalorieStore
    @Environment(ToastManager.self) private var toastManager
    let date: Date
    var onDone: () -> Void

    @State private var name = ""
    @State private var caloriesText = ""
    @FocusState private var nameFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add Food Item")
                .font(.headline)

            TextField("Food name (e.g. Chicken Salad)", text: $name)
                .textFieldStyle(.roundedBorder)
                .focused($nameFieldFocused)

            TextField("Calories (kcal)", text: $caloriesText)
                .textFieldStyle(.roundedBorder)
                .onSubmit { addItem() }

            HStack {
                Spacer()
                Button("Cancel") { onDone() }
                    .keyboardShortcut(.cancelAction)
                Button("Add") { addItem() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (Int(caloriesText) ?? 0) <= 0)
            }
        }
        .padding(20)
        .frame(width: 360)
        .onAppear { nameFieldFocused = true }
    }

    private func addItem() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let cal = Int(caloriesText), cal > 0 else { return }
        calorieStore.addFood(name: trimmed, calories: cal, date: date)
        toastManager.show(ToastItem(
            icon: "fork.knife",
            iconColor: .orange,
            title: "\(trimmed) Logged",
            subtitle: "\(cal) kcal"
        ))
        onDone()
    }
}

// MARK: - Settings Sheet

struct CalorieSettingsSheet: View {
    @Bindable var calorieStore: CalorieStore
    var onDone: () -> Void

    @State private var calorieGoalText = ""
    @State private var waterGoalText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Goals")
                .font(.headline)

            VStack(alignment: .leading, spacing: 4) {
                Text("Daily Calorie Goal (kcal)")
                    .font(.subheadline.weight(.medium))
                TextField("e.g. 2000", text: $calorieGoalText)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Daily Water Goal (ml)")
                    .font(.subheadline.weight(.medium))
                TextField("e.g. 3000", text: $waterGoalText)
                    .textFieldStyle(.roundedBorder)
                Text(String(format: "%.1f liters", Double(Int(waterGoalText) ?? 0) / 1000.0))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack {
                Spacer()
                Button("Cancel") { onDone() }
                    .keyboardShortcut(.cancelAction)
                Button("Save") {
                    let cal = Int(calorieGoalText) ?? calorieStore.config.dailyCalorieGoal
                    let water = Int(waterGoalText) ?? calorieStore.config.dailyWaterGoalML
                    calorieStore.updateConfig(CalorieConfig(
                        dailyCalorieGoal: max(100, cal),
                        dailyWaterGoalML: max(250, water)
                    ))
                    onDone()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(20)
        .frame(width: 340)
        .onAppear {
            calorieGoalText = "\(calorieStore.config.dailyCalorieGoal)"
            waterGoalText = "\(calorieStore.config.dailyWaterGoalML)"
        }
    }
}
