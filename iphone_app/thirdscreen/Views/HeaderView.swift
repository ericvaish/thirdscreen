//
//  HeaderView.swift
//  thirdscreen
//

import SwiftUI

struct HeaderView: View {
    let layout: DashboardLayout
    let onLayoutUpdate: (DashboardLayout) -> Void
    let spotify: SpotifyService
    @Binding var showSettings: Bool
    @State private var showComponentsMenu = false
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 12 : 16) {
            if !compact {
                Text("ThirdScreen")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity)
            }
            HStack(spacing: 12) {
                componentsMenuButton
                settingsButton
            }
        }
        .padding(.leading, compact ? 0 : 88)
        .padding(.trailing, compact ? 0 : 20)
        .padding(.vertical, compact ? 0 : 6)
    }

    private var componentsMenuButton: some View {
        Button {
            showComponentsMenu = true
        } label: {
            Label("Add Component", systemImage: "plus")
                .labelStyle(.iconOnly)
                .frame(minWidth: 32, minHeight: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showComponentsMenu, arrowEdge: .bottom) {
            ComponentsMenuView(
                layout: layout,
                onLayoutUpdate: onLayoutUpdate
            )
            .frame(minWidth: 220, minHeight: 280)
        }
    }

    private var settingsButton: some View {
        Button {
            showSettings = true
        } label: {
            Label("Settings", systemImage: "gearshape")
                .labelStyle(.iconOnly)
                .frame(minWidth: 32, minHeight: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct ComponentsMenuView: View {
    let layout: DashboardLayout
    let onLayoutUpdate: (DashboardLayout) -> Void

    private var visibleSectionIds: Set<DashboardSection> {
        Set(layout.orderedSections.map(\.id))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Dashboard Components")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(DashboardSection.allCases, id: \.self) { section in
                        ComponentToggleRow(
                            section: section,
                            isVisible: visibleSectionIds.contains(section),
                            onToggle: { add in
                                var next = layout
                                if add {
                                    next.addSection(section)
                                } else {
                                    next.removeSection(section)
                                }
                                onLayoutUpdate(next)
                            }
                        )
                    }
                }
                .padding(12)
            }
        }
    }
}

private struct ComponentToggleRow: View {
    let section: DashboardSection
    let isVisible: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isVisible)
        } label: {
            HStack {
                Text(section.displayTitle)
                    .font(.body)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { isVisible },
                    set: { onToggle($0) }
                ))
                .toggleStyle(.switch)
                .labelsHidden()
                .allowsHitTesting(false)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(isVisible ? Color.accentColor.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}
