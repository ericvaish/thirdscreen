import SwiftUI

struct ShortcutsView: View {
    @Bindable var shortcutsService: ShortcutsService
    @State private var newShortcutName = ""
    @State private var selectedSymbol = ShortcutIconOption.defaultOption

    private let grid = [GridItem(.adaptive(minimum: 180, maximum: 260), spacing: 12)]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            addActionRow

            if let message = shortcutsService.lastRunMessage, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let error = shortcutsService.lastRunError, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if shortcutsService.actions.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVGrid(columns: grid, spacing: 12) {
                        ForEach(shortcutsService.actions) { action in
                            shortcutButton(action)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Quick Shortcuts")
                .font(.title3.weight(.semibold))
            Text("Run Apple Shortcuts in one click. Create shortcuts in the Shortcuts app, then add their names here.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var addActionRow: some View {
        HStack(spacing: 8) {
            TextField("Shortcut name (exact match)", text: $newShortcutName)
                .textFieldStyle(.roundedBorder)
                .onSubmit(addShortcut)

            Menu {
                ForEach(ShortcutIconOption.allCases) { option in
                    Button {
                        selectedSymbol = option
                    } label: {
                        HStack {
                            Image(systemName: option.symbolName)
                            Text(option.label)
                        }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: selectedSymbol.symbolName)
                        .frame(width: 20)
                    Text(selectedSymbol.label)
                }
            }
            .menuStyle(.borderlessButton)
            .fixedSize()

            Button("Add") {
                addShortcut()
            }
            .buttonStyle(.borderedProminent)
            .disabled(newShortcutName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button("Open Shortcuts") {
                shortcutsService.openShortcutsApp()
            }
            .buttonStyle(.bordered)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No quick shortcuts yet.")
                .font(.subheadline.weight(.medium))
            Text("Example names: \"Desk Lamp On\", \"Movie Mode\", \"Standup Prep\".")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    private func shortcutButton(_ action: ShortcutQuickAction) -> some View {
        Button {
            shortcutsService.runAction(action)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: action.symbolName)
                    .font(.headline)
                    .frame(width: 20)
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 4) {
                    Text(action.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                    Text("Run now")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(.quaternary, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Run") {
                shortcutsService.runAction(action)
            }
            Button("Delete", role: .destructive) {
                shortcutsService.removeAction(action)
            }
        }
    }

    private func addShortcut() {
        let name = newShortcutName
        shortcutsService.addAction(named: name, symbolName: selectedSymbol.symbolName)
        if shortcutsService.lastRunError == nil {
            newShortcutName = ""
        }
    }
}

private enum ShortcutIconOption: String, CaseIterable, Identifiable {
    case bolt = "bolt.fill"
    case light = "lightbulb.fill"
    case home = "house.fill"
    case music = "music.note"
    case moon = "moon.fill"
    case fan = "fan.fill"
    case tv = "tv.fill"
    case desk = "laptopcomputer"

    static let defaultOption: ShortcutIconOption = .bolt

    var id: String { rawValue }
    var symbolName: String { rawValue }

    var label: String {
        switch self {
        case .bolt:
            return "General"
        case .light:
            return "Lighting"
        case .home:
            return "Home"
        case .music:
            return "Music"
        case .moon:
            return "Night"
        case .fan:
            return "Climate"
        case .tv:
            return "Media"
        case .desk:
            return "Desk"
        }
    }
}

#Preview {
    ShortcutsView(shortcutsService: ShortcutsService())
}
