import SwiftUI

struct ManageCardsView: View {
    @Environment(\.dismiss) private var dismiss

    let layout: DashboardLayoutV2
    let displayName: (CardPlacement) -> String
    let mediaConfig: (UUID) -> MediaCardConfig?
    let onSetHidden: (UUID, Bool) -> Void
    let onRename: (UUID, String?) -> Void
    let onDelete: (UUID) -> Void
    let onSetMediaProvider: (UUID, MediaProvider) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Manage Cards")
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
                    ForEach(layout.cards, id: \.instanceID) { card in
                        ManageCardRow(
                            card: card,
                            displayName: displayName(card),
                            mediaConfig: mediaConfig(card.instanceID),
                            onSetHidden: onSetHidden,
                            onRename: onRename,
                            onDelete: onDelete,
                            onSetMediaProvider: onSetMediaProvider
                        )
                    }
                }
                .padding(12)
            }
        }
        .frame(minWidth: 460, minHeight: 420)
    }
}

private struct ManageCardRow: View {
    let card: CardPlacement
    let displayName: String
    let mediaConfig: MediaCardConfig?
    let onSetHidden: (UUID, Bool) -> Void
    let onRename: (UUID, String?) -> Void
    let onDelete: (UUID) -> Void
    let onSetMediaProvider: (UUID, MediaProvider) -> Void

    @State private var draftTitle: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: iconName(for: card.kind))
                    .foregroundStyle(.secondary)
                Text(card.kind.displayTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(card.instanceID.uuidString.prefix(8))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.tertiary)
            }

            HStack(spacing: 8) {
                TextField(displayName, text: $draftTitle)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        saveTitle()
                    }
                Button(card.isHidden ? "Show" : "Hide") {
                    onSetHidden(card.instanceID, !card.isHidden)
                }
                .buttonStyle(.bordered)

                Button("Delete", role: .destructive) {
                    onDelete(card.instanceID)
                }
                .buttonStyle(.bordered)
            }

            if card.kind == .media, let mediaConfig {
                HStack(spacing: 8) {
                    Text("Provider")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Picker("Provider", selection: Binding(
                        get: { mediaConfig.provider },
                        set: { onSetMediaProvider(card.instanceID, $0) }
                    )) {
                        ForEach(MediaProvider.allCases) { provider in
                            Text(provider.title).tag(provider)
                        }
                    }
                    .pickerStyle(.menu)
                    Spacer()
                }
            }
        }
        .padding(10)
        .background(.quaternary.opacity(0.2), in: RoundedRectangle(cornerRadius: 10))
        .onAppear {
            draftTitle = card.title ?? ""
        }
        .onChange(of: card.title) { _, newValue in
            draftTitle = newValue ?? ""
        }
    }

    private func saveTitle() {
        let trimmed = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        onRename(card.instanceID, trimmed.isEmpty ? nil : trimmed)
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
}
