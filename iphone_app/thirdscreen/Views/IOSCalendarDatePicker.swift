import SwiftUI

struct IOSCalendarDatePicker: View {
    @Binding var selectedDate: Date

    @State private var displayedMonthStart: Date
    private let calendar: Calendar

    init(selectedDate: Binding<Date>, calendar: Calendar = .current) {
        _selectedDate = selectedDate
        self.calendar = calendar
        _displayedMonthStart = State(initialValue: calendar.startOfMonth(for: selectedDate.wrappedValue))
    }

    private let columns = Array(repeating: GridItem(.flexible(minimum: 26, maximum: 44), spacing: 8), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 12) {
                HStack(spacing: 6) {
                    Text(displayedMonthStart.formatted(.dateTime.month(.wide).year()))
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.primary)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }

                Spacer(minLength: 0)

                monthButton(delta: -1, systemImage: "chevron.left")
                monthButton(delta: 1, systemImage: "chevron.right")
            }

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(dayCells.indices, id: \.self) { index in
                    let cell = dayCells[index]
                    if let date = cell.date {
                        Button {
                            selectedDate = date
                        } label: {
                            Text("\(calendar.component(.day, from: date))")
                                .appScaledSystemFont(size: 18, weight: isSelected(date) ? .semibold : .regular, design: .rounded)
                                .foregroundStyle(dayForegroundColor(for: date))
                                .frame(width: 36, height: 36)
                                .background {
                                    if isSelected(date) {
                                        Circle()
                                            .fill(Color.accentColor.opacity(0.20))
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                        .contentShape(Circle())
                    } else {
                        Color.clear
                            .frame(width: 36, height: 36)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .frame(width: 320)
        .onChange(of: selectedDate) { _, newDate in
            let targetMonth = calendar.startOfMonth(for: newDate)
            if !calendar.isDate(targetMonth, equalTo: displayedMonthStart, toGranularity: .month) {
                displayedMonthStart = targetMonth
            }
        }
    }

    private var weekdaySymbols: [String] {
        let base = calendar.shortStandaloneWeekdaySymbols
        let firstIndex = max(0, min(base.count - 1, calendar.firstWeekday - 1))
        let ordered = Array(base[firstIndex...]) + Array(base[..<firstIndex])
        return ordered.map { $0.uppercased() }
    }

    private var dayCells: [DayCell] {
        guard let daysInMonth = calendar.range(of: .day, in: .month, for: displayedMonthStart) else {
            return []
        }

        let firstWeekdayOfMonth = calendar.component(.weekday, from: displayedMonthStart)
        let leadingEmptyCount = (firstWeekdayOfMonth - calendar.firstWeekday + 7) % 7

        var cells: [DayCell] = Array(repeating: DayCell(date: nil), count: leadingEmptyCount)

        for day in daysInMonth {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: displayedMonthStart) {
                cells.append(DayCell(date: date))
            }
        }

        let trailingEmptyCount = (7 - (cells.count % 7)) % 7
        if trailingEmptyCount > 0 {
            cells.append(contentsOf: Array(repeating: DayCell(date: nil), count: trailingEmptyCount))
        }

        return cells
    }

    private func monthButton(delta: Int, systemImage: String) -> some View {
        Button {
            shiftMonth(by: delta)
        } label: {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .frame(width: 24, height: 24)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.accentColor)
        .contentShape(Circle())
    }

    private func shiftMonth(by delta: Int) {
        guard let shifted = calendar.date(byAdding: .month, value: delta, to: displayedMonthStart) else {
            return
        }
        displayedMonthStart = calendar.startOfMonth(for: shifted)
    }

    private func isSelected(_ date: Date) -> Bool {
        calendar.isDate(date, inSameDayAs: selectedDate)
    }

    private func dayForegroundColor(for date: Date) -> Color {
        if isSelected(date) {
            return .accentColor
        }
        if calendar.isDateInToday(date) {
            return .accentColor
        }
        return .primary
    }
}

private struct DayCell {
    let date: Date?
}

private extension Calendar {
    func startOfMonth(for date: Date) -> Date {
        let components = dateComponents([.year, .month], from: date)
        return self.date(from: components) ?? date
    }
}

#Preview {
    IOSCalendarDatePicker(selectedDate: .constant(Date()))
}
