import SwiftUI

struct WeekStripView<TrailingContent: View>: View {
    @Binding var selectedDate: Date
    @Binding var weekOffset: Int
    @ViewBuilder var trailingContent: () -> TrailingContent

    init(
        selectedDate: Binding<Date>,
        weekOffset: Binding<Int>,
        @ViewBuilder trailingContent: @escaping () -> TrailingContent = { EmptyView() }
    ) {
        self._selectedDate = selectedDate
        self._weekOffset = weekOffset
        self.trailingContent = trailingContent
    }

    private var weekDates: [Date] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let weekStart = cal.date(byAdding: .day, value: weekOffset * 7 - 3, to: today)!
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private var selectedDateFormatted: String {
        let cal = Calendar.current
        if cal.isDateInToday(selectedDate) { return "Today" }
        if cal.isDateInYesterday(selectedDate) { return "Yesterday" }
        if cal.isDateInTomorrow(selectedDate) { return "Tomorrow" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: selectedDate)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 2) {
                Button {
                    weekOffset -= 1
                } label: {
                    Image(systemName: "chevron.left")
                        .appScaledSystemFont(size: 10, weight: .medium)
                        .foregroundStyle(.secondary)
                        .frame(width: 20, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                ForEach(weekDates, id: \.self) { date in
                    let cal = Calendar.current
                    let isSelected = cal.isDate(date, inSameDayAs: selectedDate)
                    let isToday = cal.isDateInToday(date)
                    let dayLetter = date.formatted(.dateTime.weekday(.abbreviated)).prefix(3)
                    let dayNum = cal.component(.day, from: date)

                    Button {
                        selectedDate = date
                    } label: {
                        VStack(spacing: 3) {
                            Text(String(dayLetter))
                                .appScaledSystemFont(size: 9, weight: .medium)
                                .foregroundStyle(isSelected ? .primary : .tertiary)
                            Text("\(dayNum)")
                                .appScaledSystemFont(size: 13, weight: isSelected ? .bold : .medium)
                                .foregroundStyle(isSelected ? Color.primary : (isToday ? Color.accentColor : Color.secondary))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(
                            isSelected ? Color.accentColor.opacity(0.15) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 6)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    weekOffset += 1
                } label: {
                    Image(systemName: "chevron.right")
                        .appScaledSystemFont(size: 10, weight: .medium)
                        .foregroundStyle(.secondary)
                        .frame(width: 20, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 6)
            .padding(.top, 8)
            .padding(.bottom, 4)

            HStack {
                Text(selectedDateFormatted)
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
                if !Calendar.current.isDateInToday(selectedDate) {
                    Button {
                        selectedDate = Date()
                        weekOffset = 0
                    } label: {
                        Text("Today")
                            .appScaledSystemFont(size: 10)
                            .foregroundStyle(Color.accentColor)
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                trailingContent()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
        }
    }
}
