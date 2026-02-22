import SwiftUI

struct AddCardCatalogView: View {
    @Environment(\.dismiss) private var dismiss

    let onAdd: (DashboardSection) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Add Card")
                    .font(.headline)
                Spacer()
                Button("Done") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            Divider()

            ScrollView {
                VStack(spacing: 10) {
                    ForEach(DashboardSection.allCases, id: \.self) { section in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: iconName(for: section))
                                .font(.title3)
                                .foregroundStyle(.secondary)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(section.displayTitle)
                                    .font(.body.weight(.semibold))
                                Text(description(for: section))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Button("Add") {
                                onAdd(section)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(10)
                        .background(.quaternary.opacity(0.2), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(12)
            }
        }
        .frame(minWidth: 460, minHeight: 420)
    }

    private func iconName(for section: DashboardSection) -> String {
        switch section {
        case .timer:
            return "timer"
        case .media:
            return "music.note"
        case .schedule:
            return "calendar"
        case .battery:
            return "battery.75"
        case .calendar:
            return "command"
        case .todos:
            return "checklist"
        }
    }

    private func description(for section: DashboardSection) -> String {
        switch section {
        case .timer:
            return "Clock, timer, alarm, and world time styles."
        case .media:
            return "Now playing card with provider-specific behavior."
        case .schedule:
            return "Meetings, events, and day timeline."
        case .battery:
            return "Device battery status and charging details."
        case .calendar:
            return "Shortcut actions and quick launch tiles."
        case .todos:
            return "Tasks, reminders, and completion flow."
        }
    }
}
