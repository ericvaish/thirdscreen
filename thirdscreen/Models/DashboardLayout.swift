//
//  DashboardLayout.swift
//  thirdscreen
//

import Foundation
import CoreGraphics

enum DashboardSection: String, Codable, CaseIterable {
    case timer
    case media
    case schedule
    case battery
    case calendar
    case todos

    var displayTitle: String {
        switch self {
        case .timer: return "Time"
        case .media: return "Media"
        case .schedule: return "Schedule"
        case .battery: return "Battery"
        case .calendar: return "Shortcuts"
        case .todos: return "To-Dos"
        }
    }
}

struct SectionLayout: Codable, Equatable {
    var id: DashboardSection
    var colSpan: Int
    var rowSpan: Int

    init(id: DashboardSection, colSpan: Int, rowSpan: Int) {
        self.id = id
        self.colSpan = DashboardLayout.clampColSpan(colSpan)
        self.rowSpan = DashboardLayout.clampRowUnits(rowSpan)
    }
}

struct DashboardLayout: Codable {
    static let gridColumns = 24
    static let minColSpan = 4
    static let maxColSpan = 20
    static let minRowUnits = 4
    static let maxRowUnits = 16
    static let gridUnitHeight: CGFloat = 60
    /// Minimum spacing between sections (Apple HIG: 16pt for content group separation on 8pt grid)
    static let minSectionGap: CGFloat = 16

    var orderedSections: [SectionLayout]

    init(orderedSections: [SectionLayout]? = nil) {
        self.orderedSections = orderedSections ?? DashboardLayout.defaultOrderedSections
    }

    static var defaultOrderedSections: [SectionLayout] {
        [
            SectionLayout(id: .timer, colSpan: 12, rowSpan: 8),
            SectionLayout(id: .media, colSpan: 12, rowSpan: 8),
            SectionLayout(id: .schedule, colSpan: 24, rowSpan: 10),
            SectionLayout(id: .todos, colSpan: 24, rowSpan: 8),
        ]
    }

    static func clampColSpan(_ value: Int) -> Int {
        min(max(value, minColSpan), maxColSpan)
    }

    static func clampRowUnits(_ value: Int) -> Int {
        min(max(value, minRowUnits), maxRowUnits)
    }

    func sectionLayout(for id: DashboardSection) -> SectionLayout? {
        orderedSections.first { $0.id == id }
    }

    mutating func updateSection(_ id: DashboardSection, colSpan: Int? = nil, rowSpan: Int? = nil) {
        guard let idx = orderedSections.firstIndex(where: { $0.id == id }) else { return }
        if let c = colSpan { orderedSections[idx].colSpan = Self.clampColSpan(c) }
        if let r = rowSpan { orderedSections[idx].rowSpan = Self.clampRowUnits(r) }
    }

    mutating func moveSection(from sourceIndex: Int, to destinationIndex: Int) {
        guard sourceIndex != destinationIndex,
              sourceIndex >= 0, sourceIndex < orderedSections.count,
              destinationIndex >= 0, destinationIndex <= orderedSections.count
        else { return }
        let item = orderedSections.remove(at: sourceIndex)
        let adjustedDest = destinationIndex > sourceIndex ? destinationIndex - 1 : destinationIndex
        orderedSections.insert(item, at: adjustedDest)
    }

    mutating func reorder(move sourceId: DashboardSection, toBefore targetId: DashboardSection) {
        guard sourceId != targetId,
              let fromIdx = orderedSections.firstIndex(where: { $0.id == sourceId }),
              let toIdx = orderedSections.firstIndex(where: { $0.id == targetId })
        else { return }
        let item = orderedSections.remove(at: fromIdx)
        let adjustedToIdx = toIdx > fromIdx ? toIdx - 1 : toIdx
        orderedSections.insert(item, at: adjustedToIdx)
    }

    mutating func addSection(_ section: DashboardSection, at index: Int? = nil) {
        guard !orderedSections.contains(where: { $0.id == section }) else { return }
        let defaultLayout = Self.defaultLayout(for: section)
        let insertIndex = index.map { min($0, orderedSections.count) } ?? orderedSections.count
        orderedSections.insert(defaultLayout, at: insertIndex)
    }

    mutating func removeSection(_ section: DashboardSection) {
        orderedSections.removeAll { $0.id == section }
    }

    static func defaultLayout(for section: DashboardSection) -> SectionLayout {
        switch section {
        case .timer, .media:
            return SectionLayout(id: section, colSpan: 12, rowSpan: 8)
        case .schedule:
            return SectionLayout(id: section, colSpan: 24, rowSpan: 10)
        case .battery:
            return SectionLayout(id: section, colSpan: 12, rowSpan: 6)
        case .calendar, .todos:
            return SectionLayout(id: section, colSpan: 24, rowSpan: 8)
        }
    }
}

// MARK: - Popular Layout Presets

enum LayoutPreset: String, CaseIterable {
    case balanced
    case focusSchedule
    case focusMedia
    case compact
    case presentation

    var displayName: String {
        switch self {
        case .balanced: return "Balanced"
        case .focusSchedule: return "Focus Schedule"
        case .focusMedia: return "Focus Media"
        case .compact: return "Compact"
        case .presentation: return "Presentation"
        }
    }

    var description: String {
        switch self {
        case .balanced: return "Timer and Media top, Schedule and Todos bottom — fits without scrolling"
        case .focusSchedule: return "Schedule prominent with Timer and Media — fits without scrolling"
        case .focusMedia: return "Wide media area, Schedule and Todos below — fits without scrolling"
        case .compact: return "All four cards in one row — fits without scrolling"
        case .presentation: return "Timer full width, Schedule and tasks below — fits without scrolling"
        }
    }

    /// All presets use rowSpan 4 (minimum) and ≤2 rows so content fits in min window (700pt) without scrolling.
    var layout: DashboardLayout {
        switch self {
        case .balanced:
            return DashboardLayout(orderedSections: [
                SectionLayout(id: .timer, colSpan: 12, rowSpan: 4),
                SectionLayout(id: .media, colSpan: 12, rowSpan: 4),
                SectionLayout(id: .schedule, colSpan: 12, rowSpan: 4),
                SectionLayout(id: .todos, colSpan: 12, rowSpan: 4),
            ])
        case .focusSchedule:
            return DashboardLayout(orderedSections: [
                SectionLayout(id: .timer, colSpan: 8, rowSpan: 4),
                SectionLayout(id: .media, colSpan: 8, rowSpan: 4),
                SectionLayout(id: .schedule, colSpan: 24, rowSpan: 4),
                SectionLayout(id: .todos, colSpan: 24, rowSpan: 4),
            ])
        case .focusMedia:
            return DashboardLayout(orderedSections: [
                SectionLayout(id: .timer, colSpan: 8, rowSpan: 4),
                SectionLayout(id: .media, colSpan: 16, rowSpan: 4),
                SectionLayout(id: .schedule, colSpan: 12, rowSpan: 4),
                SectionLayout(id: .todos, colSpan: 12, rowSpan: 4),
            ])
        case .compact:
            return DashboardLayout(orderedSections: [
                SectionLayout(id: .timer, colSpan: 6, rowSpan: 4),
                SectionLayout(id: .media, colSpan: 6, rowSpan: 4),
                SectionLayout(id: .schedule, colSpan: 6, rowSpan: 4),
                SectionLayout(id: .todos, colSpan: 6, rowSpan: 4),
            ])
        case .presentation:
            return DashboardLayout(orderedSections: [
                SectionLayout(id: .timer, colSpan: 24, rowSpan: 4),
                SectionLayout(id: .schedule, colSpan: 12, rowSpan: 4),
                SectionLayout(id: .media, colSpan: 6, rowSpan: 4),
                SectionLayout(id: .todos, colSpan: 6, rowSpan: 4),
            ])
        }
    }
}

// MARK: - Grid Flow Layout

struct PlacedSection {
    let section: SectionLayout
    let frame: CGRect
    let rowIndex: Int
}

struct DashboardRow {
    let height: CGFloat
    let sections: [SectionLayout]
}

extension DashboardLayout {
    /// Computes layout positions for each section using left-to-right, top-to-bottom flow.
    /// Uses fixed grid unit height (like Grafana/react-grid-layout): resizing a row grows
    /// the dashboard and scrolls, rather than shrinking other rows.
    func computeFlowLayout(
        availableWidth: CGFloat,
        gap: CGFloat = Self.minSectionGap
    ) -> [PlacedSection] {
        guard !orderedSections.isEmpty else { return [] }

        let unitHeight = Self.gridUnitHeight
        let colWidth = (availableWidth - CGFloat(Self.gridColumns - 1) * gap) / CGFloat(Self.gridColumns)

        var result: [PlacedSection] = []
        var currentCol = 0
        var currentRow = 0
        var rowHeights: [CGFloat] = []

        for section in orderedSections {
            let colSpan = min(section.colSpan, Self.gridColumns)
            let rowSpan = section.rowSpan

            if currentCol + colSpan > Self.gridColumns {
                currentCol = 0
                currentRow += 1
            }

            let rowStartY = rowHeights.prefix(currentRow).reduce(0, +) + CGFloat(currentRow) * gap
            let sectionHeight = CGFloat(rowSpan) * unitHeight
            let colStartX = CGFloat(currentCol) * (colWidth + gap)
            let sectionWidth = CGFloat(colSpan) * colWidth + CGFloat(max(0, colSpan - 1)) * gap

            if currentRow >= rowHeights.count {
                rowHeights.append(sectionHeight)
            } else {
                rowHeights[currentRow] = max(rowHeights[currentRow], sectionHeight)
            }

            result.append(PlacedSection(
                section: section,
                frame: CGRect(x: colStartX, y: rowStartY, width: sectionWidth, height: sectionHeight),
                rowIndex: currentRow
            ))

            currentCol += colSpan
            if currentCol >= Self.gridColumns {
                currentCol = 0
                currentRow += 1
            }
        }

        return result
    }

    /// Groups sections into rows for VStack/HStack rendering.
    func computeRows(
        availableWidth: CGFloat,
        gap: CGFloat = Self.minSectionGap
    ) -> [DashboardRow] {
        let placed = computeFlowLayout(availableWidth: availableWidth, gap: gap)
        var rows: [DashboardRow] = []
        var currentRowSections: [SectionLayout] = []
        var currentRowHeight: CGFloat = 0
        var lastRowIndex: Int = -1

        for placedSection in placed {
            if lastRowIndex >= 0, placedSection.rowIndex != lastRowIndex {
                if !currentRowSections.isEmpty {
                    rows.append(DashboardRow(height: currentRowHeight, sections: currentRowSections))
                }
                currentRowSections = []
                currentRowHeight = 0
            }
            currentRowSections.append(placedSection.section)
            currentRowHeight = max(currentRowHeight, placedSection.frame.height)
            lastRowIndex = placedSection.rowIndex
        }
        if !currentRowSections.isEmpty {
            rows.append(DashboardRow(height: currentRowHeight, sections: currentRowSections))
        }
        return rows
    }
}

// MARK: - Migration from legacy layout

struct LegacyDashboardLayout: Codable {
    var timerColSpan: Int?
    var scheduleRowUnits: Int?
    var calendarColSpan: Int?
    var topRowUnits: Int?
    var bottomRowUnits: Int?
}

extension DashboardLayout {
    static func decodeWithMigration(from data: Data) -> DashboardLayout? {
        if var layout = try? JSONDecoder().decode(DashboardLayout.self, from: data) {
            layout.orderedSections.removeAll { $0.id == .calendar }
            return layout
        }
        if let legacy = try? JSONDecoder().decode(LegacyDashboardLayout.self, from: data) {
            return DashboardLayout.fromLegacy(legacy)
        }
        return nil
    }

    private static func fromLegacy(_ legacy: LegacyDashboardLayout) -> DashboardLayout {
        let timerSpan = legacy.timerColSpan ?? 12
        let scheduleRows = legacy.scheduleRowUnits ?? 10
        let topRows = legacy.topRowUnits ?? 8
        let bottomRows = legacy.bottomRowUnits ?? 8
        return DashboardLayout(orderedSections: [
            SectionLayout(id: .timer, colSpan: timerSpan, rowSpan: topRows),
            SectionLayout(id: .media, colSpan: Self.gridColumns - timerSpan, rowSpan: topRows),
            SectionLayout(id: .schedule, colSpan: Self.gridColumns, rowSpan: scheduleRows),
            SectionLayout(id: .todos, colSpan: Self.gridColumns, rowSpan: bottomRows),
        ])
    }
}
