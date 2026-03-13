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

            List {
                ForEach(DashboardSection.allCases, id: \.self) { section in
                    HStack(spacing: 10) {
                        Image(systemName: iconName(for: section))
                            .foregroundStyle(.secondary)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 1) {
                            Text(section.displayTitle)
                                .font(.body.weight(.medium))
                            Text(description(for: section))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Button {
                            onAdd(section)
                        } label: {
                            Image(systemName: "plus")
                        }
                        .buttonStyle(.glass)
                        .buttonBorderShape(.circle)
                    }
                    .padding(.vertical, 2)
                }
            }
            .listStyle(.inset)
        }
        .frame(minWidth: 460, idealHeight: 700)
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
        case .notes, .localNotes:
            return "note.text"
        case .icloudNotes:
            return "icloud"
        case .medicines:
            return "pills.fill"
        case .aiChat:
            return "sparkles"
        case .calories:
            return "flame.fill"
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
        case .notes:
            return "Quick notes and checklists."
        case .icloudNotes:
            return "Notes and checklists synced via iCloud."
        case .localNotes:
            return "Notes and checklists stored locally on this device."
        case .medicines:
            return "Track medicines, schedules, and reminders with iCloud sync."
        case .aiChat:
            return "Chat with local AI models on-device."
        case .calories:
            return "Track food intake, calories, and daily water consumption."
        }
    }
}
