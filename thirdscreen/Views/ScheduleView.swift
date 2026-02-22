//
//  ScheduleView.swift
//  thirdscreen
//

import SwiftUI
import EventKit
import AppKit
import OSLog

private struct ScheduleItemLayout: Identifiable {
    let item: ScheduleItem
    let column: Int
    let totalColumns: Int
    var id: String {
        "\(item.id)|\(Int(item.startDate.timeIntervalSince1970))|\(Int(item.endDate.timeIntervalSince1970))"
    }
}

private struct TimelineScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

private enum ScheduleModal: Identifiable {
    case addTodo
    case details(ScheduleItem)
    case edit(ScheduleItem)

    var id: String {
        switch self {
        case .addTodo:
            return "add-todo"
        case .details(let item):
            return "details-\(item.id)"
        case .edit(let item):
            return "edit-\(item.id)"
        }
    }
}

struct ScheduleView: View {
    @Bindable var todoStore: TodoStore
    @Bindable var calendarService: CalendarService
    @Bindable var googleCalendarService: GoogleCalendarService
    @AppStorage("schedulePrimaryStartHour") private var primaryStartHour = 6
    @AppStorage("schedulePrimaryEndHour") private var primaryEndHour = 22
    @AppStorage("scheduleAutoRecenterIntervalSeconds") private var autoRecenterIntervalSeconds = 60
    @State private var selectedDate = Date()
    @State private var requestedAccess = false
    @State private var activeModal: ScheduleModal?
    @State private var showDatePicker = false
    @State private var newTodoTitle = ""
    @State private var newTodoStart = Date()
    @State private var newTodoDuration = 30
    @State private var eventEditError: String?
    @State private var timelineScrollOffset: CGFloat = 0
    @State private var lastManualScrollDate: Date?
    @State private var suppressManualScrollTrackingUntil: Date = .distantPast
    @State private var forceRecenterToken = UUID()
    @State private var hasAlignedTimeline = false

    private let hourHeight: CGFloat = 32
    private let minBlockHeight: CGFloat = 36
    private let listModeThreshold: CGFloat = 420
    private let timelinePadding: CGFloat = 16
    private let recenterTolerance: CGFloat = 20
    private let upcomingWindowSeconds: TimeInterval = 2 * 60 * 60
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "thirdscreen", category: "ScheduleView")

    private var hourRange: ClosedRange<Int> {
        let clampedStart = min(max(primaryStartHour, 0), 22)
        let clampedEnd = min(max(primaryEndHour, 1), 23)
        if clampedEnd <= clampedStart {
            return clampedStart...(clampedStart + 1)
        }
        return clampedStart...clampedEnd
    }

    private var hourCount: Int {
        hourRange.upperBound - hourRange.lowerBound + 1
    }

    private var timelineHeight: CGFloat {
        CGFloat(hourCount) * hourHeight
    }

    private var timelineContentHeight: CGFloat {
        timelineHeight + (timelinePadding * 2)
    }

    private var autoRecenterInterval: TimeInterval? {
        autoRecenterIntervalSeconds <= 0 ? nil : TimeInterval(autoRecenterIntervalSeconds)
    }

    private var isToday: Bool {
        Calendar.current.isDate(selectedDate, inSameDayAs: Date())
    }

    private var hasAnyCalendarConnection: Bool {
        calendarService.isAuthorized || googleCalendarService.isConnected
    }

    private func currentTimeOffset(for date: Date) -> CGFloat {
        let cal = Calendar.current
        let h = Double(cal.component(.hour, from: date)) + Double(cal.component(.minute, from: date)) / 60
        return (h - Double(hourRange.lowerBound)) * hourHeight
    }

    private func clampedCurrentTimeOffset(for date: Date) -> CGFloat {
        min(max(0, currentTimeOffset(for: date)), timelineHeight)
    }

    var body: some View {
        Group {
            if !hasAnyCalendarConnection {
                accessView
            } else {
                scheduleContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            if !requestedAccess {
                requestedAccess = true
                _ = await calendarService.requestAccess()
            }
            await googleCalendarService.refreshSessionAndEventsIfNeeded()
        }
        .sheet(item: $activeModal) { modal in
            switch modal {
            case .addTodo:
                VStack(spacing: 20) {
                    Text("Add Scheduled To-Do").font(.title2)
                    TextField("Title", text: $newTodoTitle).textFieldStyle(.roundedBorder)
                    DatePicker("Start", selection: $newTodoStart, displayedComponents: [.date, .hourAndMinute])
                        .datePickerStyle(.compact)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Duration").font(.caption).foregroundStyle(.secondary)
                        DurationPickerView(duration: $newTodoDuration)
                    }
                    HStack {
                        Button("Cancel") {
                            activeModal = nil
                            resetNewTodo()
                        }
                        .buttonStyle(.bordered)
                        Button("Add") {
                            todoStore.add(TodoItem(title: newTodoTitle, scheduledStart: newTodoStart, durationMinutes: newTodoDuration))
                            activeModal = nil
                            resetNewTodo()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(newTodoTitle.isEmpty)
                    }
                }
                .padding(24)
                .frame(width: 360)
            case .details(let item):
                EventDetailsSheet(
                    item: item,
                    sourceLabel: sourceLabel(for: item),
                    sourceColor: colorForItem(item),
                    canEdit: canEdit(item),
                    onEdit: { beginEditing($0) },
                    onJoin: { joinMeeting($0) },
                    onOpenURL: { NSWorkspace.shared.open($0) }
                )
            case .edit(let item):
                EventEditSheet(
                    item: item,
                    sourceLabel: sourceLabel(for: item),
                    onSave: { draft in
                        await saveEdits(for: item, draft: draft)
                    }
                )
            }
        }
        .alert("Event Update Failed", isPresented: Binding(
            get: { eventEditError != nil },
            set: { if !$0 { eventEditError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(eventEditError ?? "Unknown error")
        }
    }

    private var accessView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "calendar.badge.exclamationmark")
                .appScaledSystemFont(size: 48)
                .foregroundStyle(.secondary)
            Text("Connect a Calendar")
                .font(.title2)
            Text("Connect Apple Calendar or Google Calendar to show schedule events.")
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button(calendarService.isDenied ? "Open Apple Settings" : "Connect Apple Calendar") {
                    if calendarService.isDenied {
                        calendarService.openSystemSettings()
                    } else {
                        Task {
                            _ = await calendarService.requestAccess()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)

                Button("Connect Google Calendar") {
                    googleCalendarService.connect()
                }
                .buttonStyle(.bordered)
                .disabled(!googleCalendarService.isConfigured || googleCalendarService.isConnecting)
            }
            if !googleCalendarService.isConfigured {
                Text("Google Calendar is not configured yet. Add `GoogleCalendarClientID` and `GoogleCalendarRedirectURI` in Info.plist.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let error = googleCalendarService.connectionError, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding(24)
    }

    private var scheduleContent: some View {
        GeometryReader { geo in
            let items = scheduleItems(for: selectedDate)
            let upcoming = upcomingCalls(from: items, now: Date())
            let baseHeaderHeight: CGFloat = 54
            let upcomingStripHeight: CGFloat = isToday && !upcoming.isEmpty ? 96 : 0
            let legendHeight: CGFloat = 26
            let scrollHeight = max(0, geo.size.height - baseHeaderHeight - upcomingStripHeight - legendHeight)
            let useListMode = geo.size.width < listModeThreshold

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Spacer()
                    Button {
                        selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: selectedDate) ?? selectedDate
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button {
                        showDatePicker = true
                    } label: {
                        HStack(spacing: 6) {
                            Text(selectedDate.formatted(date: .abbreviated, time: .omitted))
                            Image(systemName: "calendar")
                                .font(.caption2)
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .popover(isPresented: $showDatePicker, arrowEdge: .bottom) {
                        IOSCalendarDatePicker(selectedDate: $selectedDate)
                    }

                    Button {
                        selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: selectedDate) ?? selectedDate
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button {
                        if !isToday {
                            selectedDate = Date()
                        }
                        forceRecenterToken = UUID()
                    } label: {
                        Image(systemName: "scope")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button { activeModal = .addTodo } label: { Label("Add To-Do", systemImage: "plus") }
                        .buttonStyle(.borderedProminent)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                if isToday && !upcoming.isEmpty {
                    upcomingCallsStrip(calls: upcoming)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                }

                Divider()
                if useListMode {
                    scheduleListView(scrollHeight: scrollHeight, items: items)
                } else {
                    scheduleTimelineView(scrollHeight: scrollHeight, items: items)
                }
                scheduleLegend
                    .frame(height: legendHeight)
                    .padding(.horizontal, 16)
            }
        }
        .clipped()
        .onAppear {
            ensureHourRangeDefaultsAreValid()
        }
    }

    private func scheduleListView(scrollHeight: CGFloat, items: [ScheduleItem]) -> some View {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(items) { item in
                    scheduleListRow(item: item, formatter: formatter)
                }
            }
            .padding(16)
        }
        .frame(height: scrollHeight)
    }

    private func scheduleListRow(item: ScheduleItem, formatter: DateFormatter) -> some View {
        let itemColor = colorForItem(item)

        return HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.subheadline).fontWeight(.medium)
                Text("\(formatter.string(from: item.startDate)) – \(formatter.string(from: item.endDate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let provider = item.joinInfo?.provider {
                    providerBadge(provider)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(itemColor.opacity(0.3))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(itemColor, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 8))
        .onTapGesture {
            activeModal = .details(item)
        }
    }

    private func scheduleTimelineView(scrollHeight: CGFloat, items: [ScheduleItem]) -> some View {
        ScrollViewReader { proxy in
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                let timelineSecond = Int(timeline.date.timeIntervalSince1970)
                ScrollView {
                    ZStack(alignment: .topLeading) {
                        GeometryReader { timelineGeo in
                            let labelWidth: CGFloat = 52
                            let labelGap: CGFloat = 10
                            let eventsStartX = labelWidth + labelGap
                            let eventsWidth = max(0, timelineGeo.size.width - eventsStartX)
                            let layouts = layoutOverlappingItems(items)

                            ZStack(alignment: .topLeading) {
                                VStack(spacing: 0) {
                                    ForEach(hourRange, id: \.self) { hour in
                                        HStack(alignment: .top, spacing: labelGap) {
                                            timelineHourLabel(hour)
                                                .frame(width: labelWidth, alignment: .trailing)

                                            Rectangle()
                                                .fill(Color.primary.opacity(0.16))
                                                .frame(height: 1)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                        }
                                        .frame(height: hourHeight, alignment: .top)
                                        .id(hour)
                                    }
                                }

                                ForEach(layouts) { layout in
                                    scheduleBlock(
                                        item: layout.item,
                                        column: layout.column,
                                        totalColumns: layout.totalColumns,
                                        availableWidth: eventsWidth,
                                        hourHeight: hourHeight
                                    )
                                    .offset(x: eventsStartX)
                                }
                            }
                        }
                        .frame(height: timelineHeight)
                        if isToday {
                            VStack(spacing: 0) {
                                Spacer().frame(height: clampedCurrentTimeOffset(for: timeline.date))
                                Rectangle()
                                    .fill(Color.red)
                                    .frame(height: 2)
                                    .frame(maxWidth: .infinity)
                                    .id("now")
                            }
                            .frame(maxWidth: .infinity, alignment: .top)
                            .allowsHitTesting(false)
                        }
                    }
                    .padding(timelinePadding)
                    .background {
                        GeometryReader { contentGeo in
                            Color.clear
                                .preference(
                                    key: TimelineScrollOffsetPreferenceKey.self,
                                    value: -contentGeo.frame(in: .named("scheduleTimelineScroll")).minY
                                )
                        }
                    }
                }
                .coordinateSpace(name: "scheduleTimelineScroll")
                .frame(height: scrollHeight)
                .onPreferenceChange(TimelineScrollOffsetPreferenceKey.self) { newOffset in
                    let previousOffset = timelineScrollOffset
                    timelineScrollOffset = max(0, newOffset)
                    if hasAlignedTimeline,
                       abs(timelineScrollOffset - previousOffset) > 0.5,
                       Date() > suppressManualScrollTrackingUntil {
                        lastManualScrollDate = Date()
                    }
                }
                .onAppear {
                    DispatchQueue.main.async {
                        centerNowImmediately(proxy: proxy)
                    }
                }
                .onChange(of: selectedDate) { _, _ in
                    centerNowImmediately(proxy: proxy)
                }
                .onChange(of: timelineSecond) { _, _ in
                    autoRecenterIfNeeded(proxy: proxy, now: timeline.date, scrollHeight: scrollHeight)
                }
                .onChange(of: forceRecenterToken) { _, _ in
                    centerNowImmediately(proxy: proxy)
                }
            }
        }
    }

    private func scrollToNow(proxy: ScrollViewProxy, animated: Bool) {
        guard isToday else { return }
        suppressManualScrollTrackingUntil = Date().addingTimeInterval(0.8)
        if animated {
            withAnimation(.easeInOut(duration: 0.3)) {
                proxy.scrollTo("now", anchor: .center)
            }
        } else {
            proxy.scrollTo("now", anchor: .center)
        }
    }

    private func autoRecenterIfNeeded(proxy: ScrollViewProxy, now: Date, scrollHeight: CGFloat) {
        guard let interval = autoRecenterInterval else { return }
        guard isToday else { return }
        guard let lastManualScrollDate else { return }
        guard now.timeIntervalSince(lastManualScrollDate) >= interval else { return }
        guard !isCurrentTimeLineCentered(now: now, scrollHeight: scrollHeight) else { return }
        scrollToNow(proxy: proxy, animated: true)
        self.lastManualScrollDate = nil
    }

    private func isCurrentTimeLineCentered(now: Date, scrollHeight: CGFloat) -> Bool {
        let nowY = timelinePadding + clampedCurrentTimeOffset(for: now)
        let targetOffset = nowY - (scrollHeight / 2)
        let maxOffset = max(0, timelineContentHeight - scrollHeight)
        let clampedTarget = max(0, min(maxOffset, targetOffset))
        return abs(timelineScrollOffset - clampedTarget) <= recenterTolerance
    }

    private func ensureHourRangeDefaultsAreValid() {
        let clampedStart = min(max(primaryStartHour, 0), 22)
        let clampedEnd = min(max(primaryEndHour, 1), 23)
        if clampedStart != primaryStartHour {
            primaryStartHour = clampedStart
        }
        if clampedEnd != primaryEndHour {
            primaryEndHour = clampedEnd
        }
        if primaryEndHour <= primaryStartHour {
            primaryEndHour = min(23, primaryStartHour + 1)
        }
    }

    private func centerNowImmediately(proxy: ScrollViewProxy) {
        hasAlignedTimeline = false
        lastManualScrollDate = nil
        scrollToNow(proxy: proxy, animated: false)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85) {
            hasAlignedTimeline = true
        }
    }

    private func layoutOverlappingItems(_ items: [ScheduleItem]) -> [ScheduleItemLayout] {
        guard !items.isEmpty else { return [] }
        var groupedLayouts: [ScheduleItemLayout] = []
        var currentGroup: [ScheduleItem] = []
        var currentGroupLatestEnd: Date?

        for item in items.sorted(by: { lhs, rhs in
            if lhs.startDate != rhs.startDate {
                return lhs.startDate < rhs.startDate
            }
            return lhs.endDate < rhs.endDate
        }) {
            if let latestEnd = currentGroupLatestEnd, item.startDate >= latestEnd {
                groupedLayouts.append(contentsOf: layoutColumns(for: currentGroup))
                currentGroup = [item]
                currentGroupLatestEnd = item.endDate
            } else {
                currentGroup.append(item)
                currentGroupLatestEnd = max(currentGroupLatestEnd ?? item.endDate, item.endDate)
            }
        }

        if !currentGroup.isEmpty {
            groupedLayouts.append(contentsOf: layoutColumns(for: currentGroup))
        }

        return groupedLayouts
    }

    private func layoutColumns(for items: [ScheduleItem]) -> [ScheduleItemLayout] {
        guard !items.isEmpty else { return [] }
        var columnEndTimes: [Date] = []
        var result: [ScheduleItemLayout] = []
        for item in items {
            var placed = false
            for (col, endTime) in columnEndTimes.enumerated() {
                if item.startDate >= endTime {
                    columnEndTimes[col] = item.endDate
                    result.append(ScheduleItemLayout(item: item, column: col, totalColumns: 0))
                    placed = true
                    break
                }
            }
            if !placed {
                let newCol = columnEndTimes.count
                columnEndTimes.append(item.endDate)
                result.append(ScheduleItemLayout(item: item, column: newCol, totalColumns: 0))
            }
        }
        let totalColumns = max(1, columnEndTimes.count)
        return result.map { ScheduleItemLayout(item: $0.item, column: $0.column, totalColumns: totalColumns) }
    }

    private func scheduleBlock(item: ScheduleItem, column: Int, totalColumns: Int, availableWidth: CGFloat, hourHeight: CGFloat) -> some View {
        let itemColor = colorForItem(item)
        let cal = Calendar.current
        let sh = Double(cal.component(.hour, from: item.startDate)) + Double(cal.component(.minute, from: item.startDate)) / 60
        let eh = Double(cal.component(.hour, from: item.endDate)) + Double(cal.component(.minute, from: item.endDate)) / 60
        let topOffset = (sh - Double(hourRange.lowerBound)) * hourHeight
        let blockHeight = max(minBlockHeight, (eh - sh) * hourHeight)
        let gap: CGFloat = 4
        let cols = max(1, totalColumns)
        let usableWidth = max(0, availableWidth - gap * CGFloat(cols - 1))
        let blockWidth = usableWidth / CGFloat(cols)
        let xOffset = CGFloat(column) * (blockWidth + gap)
        let timeString = compactTimeString(start: item.startDate, end: item.endDate, maxWidth: blockWidth)

        return Button {
            activeModal = .details(item)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .top, spacing: 4) {
                    Text(item.title)
                        .font(.caption)
                        .fontWeight(.medium)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Spacer(minLength: 0)
                }

                Text(timeString)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                if let provider = item.joinInfo?.provider, blockHeight > 54, blockWidth > 120 {
                    providerBadge(provider)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .frame(width: blockWidth, alignment: .leading)
            .frame(height: blockHeight)
            .background(itemColor.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(itemColor, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: 6))
        .offset(x: xOffset, y: topOffset)
        .zIndex(2)
    }

    private func scheduleItems(for date: Date) -> [ScheduleItem] {
        var calendarItems: [ScheduleItem] = []
        var items: [ScheduleItem] = []
        let cal = Calendar.current

        for event in calendarService.events(for: date) {
            let attendees = (event.attendees ?? []).compactMap { attendee in
                let name = attendee.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !name.isEmpty { return name }
                let email = attendee.url.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
                return email.isEmpty ? nil : email
            }
            let organizerName = event.organizer?.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let organizerEmail = event.organizer?.url.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let organizer = !organizerName.isEmpty ? organizerName : (organizerEmail.isEmpty ? nil : organizerEmail)
            calendarItems.append(
                ScheduleItem(
                    id: event.eventIdentifier ?? UUID().uuidString,
                    title: event.title ?? "Untitled",
                    startDate: event.startDate,
                    endDate: event.endDate,
                    source: .calendar,
                    color: nil,
                    joinInfo: MeetingLinkExtractor.extractFromApple(
                        eventURL: event.url,
                        notes: event.notes,
                        location: event.location
                    ),
                    calendarOrigin: .apple,
                    location: event.location,
                    notes: event.notes,
                    calendarName: event.calendar.title,
                    organizer: organizer,
                    attendees: attendees,
                    eventURL: event.url,
                    status: appleStatusText(for: event.status),
                    isAllDay: event.isAllDay
                )
            )
        }

        for event in googleCalendarService.events(for: date) {
            calendarItems.append(
                ScheduleItem(
                    id: "google-\(event.id)",
                    title: event.title,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    source: .calendar,
                    color: nil,
                    joinInfo: event.joinInfo,
                    calendarOrigin: .google,
                    location: event.location,
                    notes: event.notes,
                    calendarName: "Google Calendar",
                    organizer: event.organizer,
                    attendees: event.attendees,
                    eventURL: event.eventURL,
                    status: event.status,
                    isAllDay: event.isAllDay
                )
            )
        }

        items.append(contentsOf: CalendarMeetingDeduplicator.dedupe(calendarItems))

        for todo in todoStore.items.filter({ $0.scheduledStart != nil && !$0.isCompleted }) {
            guard let start = todo.scheduledStart, cal.isDate(start, inSameDayAs: date) else { continue }
            let end = todo.endDate ?? start.addingTimeInterval(TimeInterval((todo.durationMinutes ?? 30) * 60))
            items.append(
                ScheduleItem(
                    id: todo.id.uuidString,
                    title: todo.title,
                    startDate: start,
                    endDate: end,
                    source: .todo,
                    color: nil,
                    joinInfo: nil,
                    calendarOrigin: .todo,
                    location: nil,
                    notes: nil,
                    calendarName: "To-Do",
                    organizer: nil,
                    attendees: [],
                    eventURL: nil,
                    status: todo.isCompleted ? "Completed" : "Planned",
                    isAllDay: false
                )
            )
        }

        return items.sorted { lhs, rhs in
            if lhs.startDate != rhs.startDate {
                return lhs.startDate < rhs.startDate
            }
            return lhs.id < rhs.id
        }
    }

    private func upcomingCalls(from items: [ScheduleItem], now: Date) -> [ScheduleItem] {
        let windowEnd = now.addingTimeInterval(upcomingWindowSeconds)
        return items.filter { item in
            guard item.source == .calendar,
                  item.joinInfo != nil else { return false }
            guard item.endDate > now else { return false }
            return item.startDate <= windowEnd
        }
        .sorted { lhs, rhs in
            if lhs.startDate != rhs.startDate {
                return lhs.startDate < rhs.startDate
            }
            return lhs.id < rhs.id
        }
    }

    private func upcomingCallsStrip(calls: [ScheduleItem]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(calls) { call in
                    upcomingCallCard(call)
                }
            }
        }
    }

    private func upcomingCallCard(_ item: ScheduleItem) -> some View {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"

        return VStack(alignment: .leading, spacing: 6) {
            Text(item.title)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)

            Text("\(formatter.string(from: item.startDate)) – \(formatter.string(from: item.endDate))")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(relativeTimeText(for: item, now: Date()))
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                if let provider = item.joinInfo?.provider {
                    providerBadge(provider)
                }

                Spacer(minLength: 0)
            }
        }
        .padding(10)
        .frame(width: 250, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.primary.opacity(0.12), lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 8))
        .onTapGesture {
            activeModal = .details(item)
        }
    }

    @ViewBuilder
    private func providerBadge(_ provider: MeetingProvider) -> some View {
        Text(providerLabel(provider))
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(providerColor(provider).opacity(0.2), in: Capsule())
            .foregroundStyle(providerColor(provider))
    }

    private func providerLabel(_ provider: MeetingProvider) -> String {
        switch provider {
        case .googleMeet:
            return "Meet"
        case .zoom:
            return "Zoom"
        case .generic:
            return "Link"
        }
    }

    private func providerColor(_ provider: MeetingProvider) -> Color {
        switch provider {
        case .googleMeet:
            return .green
        case .zoom:
            return .blue
        case .generic:
            return .gray
        }
    }

    private func relativeTimeText(for item: ScheduleItem, now: Date) -> String {
        if item.startDate <= now && item.endDate > now {
            return "Live now"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: item.startDate, relativeTo: now)
    }

    private func joinMeeting(_ joinInfo: MeetingJoinInfo) {
        let opened = NSWorkspace.shared.open(joinInfo.url)
        if !opened {
            logger.error("Failed to open join URL: \(joinInfo.url.absoluteString, privacy: .public)")
        }
    }

    private func compactTimeString(start: Date, end: Date, maxWidth: CGFloat) -> String {
        let duration = Int(end.timeIntervalSince(start) / 60)
        if maxWidth < 80 {
            return "\(duration)m"
        }
        if maxWidth < 110 {
            let f = DateFormatter()
            f.dateFormat = "h:mm"
            return "\(f.string(from: start))–\(f.string(from: end))"
        }
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return "\(f.string(from: start)) – \(f.string(from: end))"
    }

    @ViewBuilder
    private func timelineHourLabel(_ hour: Int) -> some View {
        let parts = hourLabelParts(for: hour)
        if parts.isNoon {
            Text(parts.hourText)
                .appScaledSystemFont(size: 14, weight: .semibold)
                .foregroundStyle(.secondary)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(parts.hourText)
                    .appScaledSystemFont(size: 17, weight: .semibold)
                    .foregroundStyle(.secondary)
                if let periodText = parts.periodText {
                    Text(periodText)
                        .appScaledSystemFont(size: 12, weight: .medium)
                        .foregroundStyle(Color.secondary.opacity(0.7))
                }
            }
        }
    }

    private func hourLabelParts(for hour: Int) -> (hourText: String, periodText: String?, isNoon: Bool) {
        let normalizedHour = ((hour % 24) + 24) % 24
        if normalizedHour == 12 {
            return ("Noon", nil, true)
        }

        var c = DateComponents()
        c.hour = hour
        c.minute = 0
        let d = Calendar.current.date(from: c) ?? Date()
        let hourFormatter = DateFormatter()
        hourFormatter.dateFormat = "h"
        let periodFormatter = DateFormatter()
        periodFormatter.dateFormat = "a"
        return (hourFormatter.string(from: d), periodFormatter.string(from: d), false)
    }

    private var scheduleLegend: some View {
        HStack(spacing: 14) {
            legendItem(color: .blue, title: "To-Do")
            legendItem(color: .yellow, title: "Apple Calendar")
            legendItem(color: .green, title: "Google Calendar")
            Spacer(minLength: 0)
        }
        .font(.caption)
    }

    @ViewBuilder
    private func legendItem(color: Color, title: String) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 9, height: 9)
            Text(title)
                .foregroundStyle(.secondary)
        }
    }

    private func colorForItem(_ item: ScheduleItem) -> Color {
        switch item.calendarOrigin {
        case .todo:
            return .blue
        case .apple:
            return .yellow
        case .google:
            return .green
        case .none:
            return item.source == .todo ? .blue : .yellow
        }
    }

    private func sourceLabel(for item: ScheduleItem) -> String {
        switch item.calendarOrigin {
        case .todo:
            return "To-Do"
        case .apple:
            return "Apple Calendar"
        case .google:
            return "Google Calendar"
        case .none:
            return item.source == .todo ? "To-Do" : "Calendar"
        }
    }

    private func canEdit(_ item: ScheduleItem) -> Bool {
        guard item.source == .calendar else { return false }
        switch item.calendarOrigin {
        case .apple, .google:
            return true
        default:
            return false
        }
    }

    private func beginEditing(_ item: ScheduleItem) {
        activeModal = nil
        DispatchQueue.main.async {
            activeModal = .edit(item)
        }
    }

    private func saveEdits(for item: ScheduleItem, draft: EventEditDraft) async {
        let normalized = normalizedDateRange(for: draft)
        let cleanedTitle = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedLocation = draft.location.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedNotes = draft.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let location: String? = cleanedLocation.isEmpty ? nil : cleanedLocation
        let notes: String? = cleanedNotes.isEmpty ? nil : cleanedNotes

        do {
            switch item.calendarOrigin {
            case .apple:
                try calendarService.updateEvent(
                    eventIdentifier: item.id,
                    title: cleanedTitle,
                    startDate: normalized.start,
                    endDate: normalized.end,
                    isAllDay: draft.isAllDay,
                    location: location,
                    notes: notes
                )
            case .google:
                try await googleCalendarService.updateEvent(
                    eventID: googleEventID(for: item),
                    title: cleanedTitle,
                    startDate: normalized.start,
                    endDate: normalized.end,
                    isAllDay: draft.isAllDay,
                    location: location,
                    notes: notes
                )
            default:
                break
            }

            activeModal = nil
            eventEditError = nil
        } catch {
            eventEditError = error.localizedDescription
        }
    }

    private func normalizedDateRange(for draft: EventEditDraft) -> (start: Date, end: Date) {
        if draft.isAllDay {
            let cal = Calendar.current
            let start = cal.startOfDay(for: draft.startDate)
            let inclusiveEnd = cal.startOfDay(for: max(draft.endDate, draft.startDate))
            let exclusiveEnd = cal.date(byAdding: .day, value: 1, to: inclusiveEnd) ?? inclusiveEnd
            return (start, exclusiveEnd)
        }
        return (draft.startDate, draft.endDate)
    }

    private func googleEventID(for item: ScheduleItem) -> String {
        guard item.calendarOrigin == .google else { return item.id }
        if item.id.hasPrefix("google-") {
            return String(item.id.dropFirst("google-".count))
        }
        return item.id
    }

    private func appleStatusText(for status: EKEventStatus) -> String? {
        switch status {
        case .none:
            return nil
        case .confirmed:
            return "Confirmed"
        case .tentative:
            return "Tentative"
        case .canceled:
            return "Canceled"
        @unknown default:
            return nil
        }
    }

    private func resetNewTodo() {
        newTodoTitle = ""
        newTodoStart = Date()
        newTodoDuration = 30
    }
}

private struct EventDetailsSheet: View {
    let item: ScheduleItem
    let sourceLabel: String
    let sourceColor: Color
    let canEdit: Bool
    let onEdit: (ScheduleItem) -> Void
    let onJoin: (MeetingJoinInfo) -> Void
    let onOpenURL: (URL) -> Void

    @Environment(\.dismiss) private var dismiss

    private var startText: String {
        if item.isAllDay {
            return item.startDate.formatted(date: .long, time: .omitted)
        }
        return item.startDate.formatted(date: .long, time: .shortened)
    }

    private var endText: String {
        if item.isAllDay {
            return item.endDate.formatted(date: .long, time: .omitted)
        }
        return item.endDate.formatted(date: .long, time: .shortened)
    }

    private var durationText: String {
        let durationMinutes = Int(max(0, item.endDate.timeIntervalSince(item.startDate)) / 60)
        if durationMinutes >= 60 {
            let hours = durationMinutes / 60
            let minutes = durationMinutes % 60
            if minutes == 0 {
                return "\(hours)h"
            }
            return "\(hours)h \(minutes)m"
        }
        return "\(durationMinutes)m"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(item.title)
                        .font(.title2)
                        .fontWeight(.semibold)

                    HStack(spacing: 8) {
                        Circle()
                            .fill(sourceColor)
                            .frame(width: 10, height: 10)
                        Text(sourceLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Divider()

                    detailRow("Start", value: startText)
                    detailRow("End", value: endText)
                    detailRow("Duration", value: durationText)

                    if let status = item.status, !status.isEmpty {
                        detailRow("Status", value: status.capitalized)
                    }
                    if let calendarName = item.calendarName, !calendarName.isEmpty {
                        detailRow("Calendar", value: calendarName)
                    }
                    if let organizer = item.organizer, !organizer.isEmpty {
                        detailRow("Organizer", value: organizer)
                    }
                    if let location = item.location, !location.isEmpty {
                        detailRow("Location", value: location)
                    }
                    if !item.attendees.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Attendees")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            ForEach(item.attendees, id: \.self) { attendee in
                                Text(attendee)
                                    .font(.body)
                            }
                        }
                    }
                    if let notes = item.notes, !notes.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Notes")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(notes)
                                .textSelection(.enabled)
                        }
                    }

                    if item.joinInfo != nil || item.eventURL != nil {
                        Divider()
                    }

                    HStack(spacing: 10) {
                        if let joinInfo = item.joinInfo {
                            Button {
                                onJoin(joinInfo)
                            } label: {
                                Label("Join Meeting", systemImage: "video.fill")
                            }
                            .buttonStyle(.borderedProminent)
                        }

                        if let eventURL = item.eventURL {
                            Button {
                                onOpenURL(eventURL)
                            } label: {
                                Label("Open Link", systemImage: "link")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                .padding(18)
            }
            .navigationTitle("Event Details")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
                if canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Edit") {
                            onEdit(item)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 520, minHeight: 460)
    }

    @ViewBuilder
    private func detailRow(_ title: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 74, alignment: .leading)
            Text(value)
                .font(.body)
                .textSelection(.enabled)
        }
    }
}

private struct EventEditDraft {
    var title: String
    var startDate: Date
    var endDate: Date
    var isAllDay: Bool
    var location: String
    var notes: String

    init(item: ScheduleItem) {
        let cal = Calendar.current
        title = item.title
        isAllDay = item.isAllDay
        if item.isAllDay {
            let start = cal.startOfDay(for: item.startDate)
            let endExclusive = cal.startOfDay(for: item.endDate)
            let endInclusive = cal.date(byAdding: .day, value: -1, to: endExclusive) ?? start
            startDate = start
            endDate = max(start, endInclusive)
        } else {
            startDate = item.startDate
            endDate = item.endDate
        }
        location = item.location ?? ""
        notes = item.notes ?? ""
    }
}

private struct EventEditSheet: View {
    let item: ScheduleItem
    let sourceLabel: String
    let onSave: (EventEditDraft) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var draft: EventEditDraft
    @State private var localError: String?
    @State private var isSaving = false

    init(item: ScheduleItem, sourceLabel: String, onSave: @escaping (EventEditDraft) async -> Void) {
        self.item = item
        self.sourceLabel = sourceLabel
        self.onSave = onSave
        _draft = State(initialValue: EventEditDraft(item: item))
    }

    private var isValid: Bool {
        let trimmedTitle = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedTitle.isEmpty {
            return false
        }
        if draft.isAllDay {
            return draft.endDate >= draft.startDate
        }
        return draft.endDate > draft.startDate
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Event") {
                    TextField("Title", text: $draft.title)
                    Text(sourceLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Toggle("All-day event", isOn: $draft.isAllDay)
                }

                Section("Timing") {
                    if draft.isAllDay {
                        DatePicker("Start Date", selection: $draft.startDate, displayedComponents: .date)
                        DatePicker("End Date", selection: $draft.endDate, in: draft.startDate..., displayedComponents: .date)
                    } else {
                        DatePicker("Start", selection: $draft.startDate, displayedComponents: [.date, .hourAndMinute])
                        DatePicker("End", selection: $draft.endDate, in: draft.startDate..., displayedComponents: [.date, .hourAndMinute])
                    }
                }

                Section("Details") {
                    TextField("Location", text: $draft.location)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $draft.notes)
                            .frame(minHeight: 110)
                    }
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Edit Event")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        localError = nil
                        if !isValid {
                            localError = "Provide a title and a valid start/end time."
                            return
                        }
                        isSaving = true
                        Task {
                            await onSave(draft)
                            isSaving = false
                        }
                    }
                    .disabled(isSaving || !isValid)
                }
            }
        }
        .frame(minWidth: 520, minHeight: 520)
    }
}

#Preview {
    ScheduleView(
        todoStore: TodoStore(),
        calendarService: CalendarService(),
        googleCalendarService: GoogleCalendarService()
    )
        .frame(width: 600, height: 600)
}
