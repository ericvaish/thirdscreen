import SwiftUI

struct LayoutPickerView: View {
    let appSize: CGSize
    let currentLayout: DashboardLayoutV2
    let workspace: LayoutWorkspace
    let isLayoutValid: Bool

    let onApplyProfile: (UUID) -> Void
    let onSaveProfile: (String, Bool) -> Void
    let onDuplicateProfile: (UUID) -> Void
    let onDeleteProfile: (UUID) -> Void
    let onRenameProfile: (UUID, String) -> Void
    let onTogglePin: (UUID) -> Void
    let onSetProfileRatioFromCurrent: (UUID) -> Void
    let onClearProfileRatio: (UUID) -> Void
    let onSetAutoSaveEnabled: (Bool) -> Void

    @State private var newProfileName = ""
    @State private var saveForCurrentRatio = true

    private var resolutionLabel: String {
        "\(Int(appSize.width)) × \(Int(appSize.height))"
    }

    private var aspectRatio: Double {
        guard appSize.height > 0 else { return 1 }
        return appSize.width / appSize.height
    }

    private var aspectRatioLabel: String {
        String(format: "%.2f", aspectRatio)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    validationSection
                    profilesSection
                }
                .padding(14)
            }
        }
        .frame(minWidth: 420, minHeight: 520)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Layouts Control Center")
                .font(.headline)
            HStack(spacing: 12) {
                Label(resolutionLabel, systemImage: "display")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Label("Ratio \(aspectRatioLabel)", systemImage: "aspectratio")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 10)
    }

    private var validationSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(isLayoutValid ? "Layout Valid" : "Layout Needs Repair", systemImage: isLayoutValid ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(isLayoutValid ? .green : .orange)
                Spacer()
                Toggle("Auto-save", isOn: Binding(
                    get: { workspace.autoSaveEnabled },
                    set: onSetAutoSaveEnabled
                ))
                .toggleStyle(.switch)
                .labelsHidden()
            }

            LayoutMiniMap(layout: currentLayout)
                .frame(height: 110)
                .background(.quaternary.opacity(0.25), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var profilesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Saved Profiles")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(workspace.profiles.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                TextField("Profile name", text: $newProfileName)
                    .textFieldStyle(.roundedBorder)
                Toggle("Use current ratio", isOn: $saveForCurrentRatio)
                    .toggleStyle(.checkbox)
                    .font(.caption)
                Button("Save") {
                    let trimmed = newProfileName.trimmingCharacters(in: .whitespacesAndNewlines)
                    onSaveProfile(trimmed.isEmpty ? "Custom \(workspace.profiles.count + 1)" : trimmed, saveForCurrentRatio)
                    newProfileName = ""
                }
                .keyboardShortcut("s", modifiers: .command)
            }

            VStack(spacing: 8) {
                ForEach(workspace.profiles) { profile in
                    ProfileRow(
                        profile: profile,
                        isCurrent: workspace.currentProfileID == profile.id,
                        onApply: { onApplyProfile(profile.id) },
                        onDuplicate: { onDuplicateProfile(profile.id) },
                        onDelete: { onDeleteProfile(profile.id) },
                        onRename: { onRenameProfile(profile.id, $0) },
                        onTogglePin: { onTogglePin(profile.id) },
                        onSetRatioFromCurrent: { onSetProfileRatioFromCurrent(profile.id) },
                        onClearRatio: { onClearProfileRatio(profile.id) }
                    )
                }
            }
        }
    }
}

private struct ProfileRow: View {
    let profile: LayoutProfile
    let isCurrent: Bool
    let onApply: () -> Void
    let onDuplicate: () -> Void
    let onDelete: () -> Void
    let onRename: (String) -> Void
    let onTogglePin: () -> Void
    let onSetRatioFromCurrent: () -> Void
    let onClearRatio: () -> Void

    @State private var draftName = ""

    private var ratioLabel: String {
        guard let ratioRange = profile.ratioRange else { return "Any ratio" }
        return String(format: "%.2f - %.2f", ratioRange.min, ratioRange.max)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                TextField("Name", text: $draftName)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        let trimmed = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty, trimmed != profile.name {
                            onRename(trimmed)
                        }
                    }

                if isCurrent {
                    Text("Current")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.accentColor.opacity(0.2), in: Capsule())
                }

                Button(profile.pinned ? "Unpin" : "Pin", action: onTogglePin)
            }

            HStack(spacing: 8) {
                Button("Apply", action: onApply)
                Button("Duplicate", action: onDuplicate)
                Button("Delete", role: .destructive, action: onDelete)
            }

            HStack(spacing: 8) {
                Text(ratioLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Set Ratio from Current", action: onSetRatioFromCurrent)
                    .font(.caption)
                Button("Clear Ratio", action: onClearRatio)
                    .font(.caption)
            }
        }
        .padding(10)
        .background(.quaternary.opacity(0.18), in: RoundedRectangle(cornerRadius: 10))
        .onAppear {
            if draftName.isEmpty {
                draftName = profile.name
            }
        }
        .onChange(of: profile.name) { _, newValue in
            draftName = newValue
        }
    }
}

private struct LayoutMiniMap: View {
    let layout: DashboardLayoutV2

    var body: some View {
        GeometryReader { geo in
            let maxY = max(1, layout.maxGridY)
            let xScale = geo.size.width / CGFloat(layout.gridColumns)
            let yScale = geo.size.height / CGFloat(maxY)

            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color.secondary.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))

                ForEach(layout.cards, id: \.id) { card in
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.accentColor.opacity(0.22))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.accentColor.opacity(0.8), lineWidth: 1)
                        )
                        .frame(width: CGFloat(card.w) * xScale, height: CGFloat(card.h) * yScale)
                        .offset(x: CGFloat(card.x) * xScale, y: CGFloat(card.y) * yScale)
                }
            }
        }
    }
}
