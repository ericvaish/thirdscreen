//
//  TimerView.swift
//  thirdscreen
//

import SwiftUI
import AppKit

struct TimerView: View {
    @Binding var config: TimeCardConfig
    let timerService: TimerService
    @Environment(ToastManager.self) private var toastManager

    private var clockPresentationRaw: String {
        get { config.clockPresentationRaw }
        nonmutating set { config.clockPresentationRaw = newValue }
    }

    private var digitalStyleRaw: String {
        get { config.digitalStyleRaw }
        nonmutating set { config.digitalStyleRaw = newValue }
    }

    private var analogStyleRaw: String {
        get { config.analogStyleRaw }
        nonmutating set { config.analogStyleRaw = newValue }
    }

    private var showSeconds: Bool {
        get { config.showSeconds }
        nonmutating set { config.showSeconds = newValue }
    }

    private var use24Hour: Bool {
        get { config.use24Hour }
        nonmutating set { config.use24Hour = newValue }
    }

    private var selectedTimeZoneID: String {
        get { config.selectedTimeZoneID }
        nonmutating set { config.selectedTimeZoneID = newValue }
    }

    private var worldTimeZoneIDsRaw: String {
        get { config.worldTimeZoneIDsRaw }
        nonmutating set { config.worldTimeZoneIDsRaw = newValue }
    }

    @State private var alarmDate = Date()
    @State private var alarmEnabled = false
    @State private var alarmFired = false

    // Editable timer segments
    enum TimerSegment: CaseIterable { case hours, minutes, seconds }
    @State private var editingSegment: TimerSegment? = nil
    @State private var inputHours: Int = 0
    @State private var inputMinutes: Int = 0
    @State private var inputSeconds: Int = 0
    @State private var segmentText: String = ""

    private var clockPresentation: TimeCardClockPresentation {
        TimeCardClockPresentation(rawValue: clockPresentationRaw) ?? .digital
    }

    private var digitalStyle: TimeCardDigitalClockStyle {
        TimeCardDigitalClockStyle(rawValue: digitalStyleRaw) ?? .stacked
    }

    private var analogStyle: TimeCardAnalogClockStyle {
        TimeCardAnalogClockStyle(rawValue: analogStyleRaw) ?? .railway
    }

    private var worldTimeZoneIDs: [String] {
        TimeCardPreferences.normalizedWorldTimeZoneIDs(
            TimeCardPreferences.decodeWorldTimeZoneIDs(worldTimeZoneIDsRaw),
            primaryZoneID: selectedTimeZoneID
        )
    }

    private var selectedTimeZone: TimeZone {
        TimeZone(identifier: TimeCardPreferences.normalizePrimaryTimeZoneID(selectedTimeZoneID)) ?? .current
    }

    var body: some View {
        VStack(spacing: 14) {
            switch config.mode {
            case .clock:
                clockContent
            case .timer:
                timerContent
            case .alarm:
                alarmContent
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .clipped()
        .onAppear {
            normalizeStoredClockSettings()
        }
        .onChange(of: timerService.isRunning) { _, newValue in
            if newValue && config.mode != .timer {
                config.modeRaw = TimeCardMode.timer.rawValue
            }
        }
        .onChange(of: selectedTimeZoneID) { _, _ in
            normalizeStoredClockSettings()
        }
    }

    private var clockContent: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            switch clockPresentation {
            case .digital:
                digitalClock(date: timeline.date)
            case .analog:
                analogClock(date: timeline.date)
            case .world:
                worldClock(date: timeline.date)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    @ViewBuilder
    private func digitalClock(date: Date) -> some View {
        switch digitalStyle {
        case .stacked:
            stackedDigitalClock(date: date)
        case .splitFlap:
            splitFlapClock(date: date)
        case .board:
            statusBoardClock(date: date)
        case .capsules:
            capsulesClock(date: date)
        case .calendar:
            calendarStackClock(date: date)
        case .binary:
            binaryClock(date: date)
        }
    }

    private func stackedDigitalClock(date: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(formattedTime(date, in: selectedTimeZone, includeSeconds: showSeconds))
                .appScaledSystemFont(size: 62, weight: .light, design: .rounded)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.55)

            HStack(spacing: 10) {
                Label(timeZoneShortName(date, in: selectedTimeZone), systemImage: "location")
                Text(formattedDate(date, in: selectedTimeZone))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func splitFlapClock(date: Date) -> some View {
        let display = displayedComponents(for: date, in: selectedTimeZone)

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(display.parts.indices, id: \.self) { index in
                    VStack(spacing: 0) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.black.opacity(0.32))
                            .frame(height: 26)
                            .overlay {
                                Divider()
                            }

                        Text(display.parts[index])
                            .appScaledSystemFont(size: 42, weight: .bold, design: .rounded)
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .padding(.vertical, 6)
                    }
                    .frame(maxWidth: .infinity)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
                }

                if !display.suffix.isEmpty {
                    Text(display.suffix)
                        .font(.headline.monospaced())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                }
            }

            Text(formattedDate(date, in: selectedTimeZone))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func statusBoardClock(date: Date) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("LOCAL BOARD", systemImage: "display")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(timeZoneShortName(date, in: selectedTimeZone))
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }

            Text(formattedTime(date, in: selectedTimeZone, includeSeconds: showSeconds))
                .appScaledSystemFont(size: 52, weight: .medium, design: .monospaced)
                .lineLimit(1)
                .minimumScaleFactor(0.6)

            Divider()

            HStack {
                Label(formattedDate(date, in: selectedTimeZone), systemImage: "calendar")
                Spacer()
                Label(dayPeriodText(for: date, in: selectedTimeZone), systemImage: "sun.max")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.18))
        )
    }

    private func capsulesClock(date: Date) -> some View {
        let display = displayedComponents(for: date, in: selectedTimeZone)

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(display.parts.indices, id: \.self) { index in
                    VStack(spacing: 2) {
                        Text(display.labels[index])
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(display.parts[index])
                            .appScaledSystemFont(size: 32, weight: .semibold, design: .rounded)
                            .monospacedDigit()
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity)
                            .background(.thinMaterial, in: Capsule())
                    }
                }
            }
            if !display.suffix.isEmpty {
                Text(display.suffix)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func calendarStackClock(date: Date) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(formattedWeekday(date, in: selectedTimeZone).uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(formattedTime(date, in: selectedTimeZone, includeSeconds: showSeconds))
                    .appScaledSystemFont(size: 46, weight: .bold, design: .rounded)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Text(formattedDayNumber(date, in: selectedTimeZone))
                    .appScaledSystemFont(size: 64, weight: .heavy, design: .rounded)
                    .foregroundStyle(.secondary.opacity(0.35))
                    .lineLimit(1)
            }

            Text(formattedDate(date, in: selectedTimeZone))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func binaryClock(date: Date) -> some View {
        let parts = binaryTimeRows(for: date, in: selectedTimeZone)

        return VStack(alignment: .leading, spacing: 8) {
            Label("BINARY MATRIX", systemImage: "square.grid.3x3")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            ForEach(parts, id: \.label) { row in
                HStack(spacing: 8) {
                    Text(row.label)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .frame(width: 26, alignment: .leading)
                    HStack(spacing: 6) {
                        ForEach(row.bits.indices, id: \.self) { index in
                            Circle()
                                .fill(row.bits[index] ? Color.accentColor : Color.secondary.opacity(0.22))
                                .frame(width: 13, height: 13)
                        }
                    }
                    Spacer()
                    Text(String(format: "%02d", row.value))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }

            Text(formattedTime(date, in: selectedTimeZone, includeSeconds: showSeconds))
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func analogClock(date: Date) -> some View {
        VStack(spacing: 10) {
            AnalogClockFace(
                date: date,
                timeZone: selectedTimeZone,
                style: analogStyle,
                showSecondHand: showSeconds
            )
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: 320)
            .frame(maxWidth: .infinity)

            HStack(spacing: 10) {
                Text(formattedTime(date, in: selectedTimeZone, includeSeconds: showSeconds))
                    .font(.headline.monospacedDigit())
                Text(timeZoneShortName(date, in: selectedTimeZone))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(8)
    }

    private func worldClock(date: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("World Clock Board")
                .font(.headline)

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(worldTimeZoneIDs, id: \.self) { zoneID in
                        worldClockRow(date: date, zoneID: zoneID)
                    }
                }
            }
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func worldClockRow(date: Date, zoneID: String) -> some View {
        let zone = TimeZone(identifier: zoneID) ?? .current
        let isPrimary = zoneID == selectedTimeZoneID

        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(timeZoneDisplayName(zoneID))
                    .font(.subheadline.weight(isPrimary ? .semibold : .regular))
                Text(formattedDate(date, in: zone))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(formattedTime(date, in: zone, includeSeconds: showSeconds))
                .font(.title3.monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(timeZoneShortName(date, in: zone))
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .frame(width: 44, alignment: .leading)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(isPrimary ? Color.accentColor.opacity(0.14) : Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var timerContent: some View {
        VStack(spacing: 20) {
            if timerService.isRunning {
                Text(timerService.formattedTime)
                    .appScaledSystemFont(size: 64, weight: .light, design: .monospaced)
                    .monospacedDigit()
            } else {
                timerSegmentEditor
            }

            if !timerService.isRunning {
                HStack(spacing: 12) {
                    ForEach([5, 15, 25, 60], id: \.self) { mins in
                        Button("\(mins)m") {
                            commitSegmentEdit()
                            inputHours = 0
                            inputMinutes = mins
                            inputSeconds = 0
                            editingSegment = nil
                            syncInputToService()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }

            HStack(spacing: 16) {
                if timerService.isRunning {
                    Button("Stop") {
                        timerService.stop()
                        syncServiceToInput()
                    }
                    .buttonStyle(.bordered)
                }
                Button(timerService.isRunning ? "Pause" : "Start") {
                    if timerService.isRunning {
                        timerService.pause()
                    } else {
                        commitSegmentEdit()
                        syncInputToService()
                        timerService.start()
                        let totalSecs = timerService.remainingSeconds
                        let h = totalSecs / 3600
                        let m = (totalSecs % 3600) / 60
                        let s = totalSecs % 60
                        var label = ""
                        if h > 0 { label += "\(h)h " }
                        if m > 0 { label += "\(m)m " }
                        if s > 0 || label.isEmpty { label += "\(s)s" }
                        toastManager.show(ToastItem(
                            icon: "timer",
                            iconColor: .orange,
                            title: "Timer Started",
                            subtitle: label.trimmingCharacters(in: .whitespaces)
                        ))
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(totalInputSeconds == 0 && !timerService.isRunning)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {
            if editingSegment != nil {
                commitSegmentEdit()
            }
        }
    }

    private var totalInputSeconds: Int {
        inputHours * 3600 + inputMinutes * 60 + inputSeconds
    }

    private func syncInputToService() {
        let total = totalInputSeconds
        timerService.stop()
        timerService.remainingSeconds = total
    }

    private func syncServiceToInput() {
        let total = timerService.remainingSeconds
        inputHours = total / 3600
        inputMinutes = (total % 3600) / 60
        inputSeconds = total % 60
    }

    private func commitSegmentEdit() {
        guard let segment = editingSegment else { return }
        let value = Int(segmentText) ?? 0
        switch segment {
        case .hours: inputHours = min(max(value, 0), 99)
        case .minutes: inputMinutes = min(max(value, 0), 59)
        case .seconds: inputSeconds = min(max(value, 0), 59)
        }
        editingSegment = nil
        segmentText = ""
    }

    private var timerSegmentEditor: some View {
        HStack(spacing: 0) {
            timerSegmentView(label: "hr", value: inputHours, segment: .hours)
            Text(":")
                .appScaledSystemFont(size: 56, weight: .light, design: .monospaced)
                .foregroundStyle(.secondary)
            timerSegmentView(label: "min", value: inputMinutes, segment: .minutes)
            Text(":")
                .appScaledSystemFont(size: 56, weight: .light, design: .monospaced)
                .foregroundStyle(.secondary)
            timerSegmentView(label: "sec", value: inputSeconds, segment: .seconds)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            // Tapping the gaps between segments commits the edit
            commitSegmentEdit()
        }
    }

    private func displayValue(for segment: TimerSegment) -> String {
        let isEditing = editingSegment == segment
        if isEditing {
            if segmentText.isEmpty { return "00" }
            let num = Int(segmentText) ?? 0
            return String(format: "%02d", num)
        }
        switch segment {
        case .hours: return String(format: "%02d", inputHours)
        case .minutes: return String(format: "%02d", inputMinutes)
        case .seconds: return String(format: "%02d", inputSeconds)
        }
    }

    private func timerSegmentView(label: String, value: Int, segment: TimerSegment) -> some View {
        let isEditing = editingSegment == segment

        return VStack(spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(displayValue(for: segment))
                .appScaledSystemFont(size: 56, weight: .light, design: .monospaced)
                .monospacedDigit()
                .overlay {
                    if isEditing {
                        SegmentTextField(
                            text: $segmentText,
                            font: NSFont.monospacedSystemFont(ofSize: 48, weight: .light),
                            onCommit: { commitSegmentEdit() },
                            onCancel: {
                                editingSegment = nil
                                segmentText = ""
                            }
                        )
                        .opacity(0.01) // Invisible but captures input
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(isEditing ? Color.accentColor.opacity(0.18) : Color.clear)
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    if !timerService.isRunning {
                        if editingSegment != nil && editingSegment != segment {
                            commitSegmentEdit()
                        }
                        editingSegment = segment
                        segmentText = ""
                    }
                }
        }
    }

    private var alarmContent: some View {
        VStack(spacing: 24) {
            DatePicker("Alarm time", selection: $alarmDate, displayedComponents: .hourAndMinute)
                .datePickerStyle(.stepperField)
                .frame(maxWidth: 300)

            Toggle("Alarm on", isOn: $alarmEnabled)
                .toggleStyle(.switch)
                .frame(maxWidth: 300)
        }
    }


    private func displayedComponents(for date: Date, in zone: TimeZone) -> (parts: [String], labels: [String], suffix: String) {
        let values = hourMinuteSecond(for: date, in: zone)
        var hour = values.hour
        var suffix = ""
        if !use24Hour {
            suffix = hour >= 12 ? "PM" : "AM"
            hour = hour % 12
            if hour == 0 { hour = 12 }
        }

        var parts = [String(format: "%02d", hour), String(format: "%02d", values.minute)]
        var labels = ["HOUR", "MIN"]

        if showSeconds {
            parts.append(String(format: "%02d", values.second))
            labels.append("SEC")
        }

        return (parts, labels, suffix)
    }

    private func binaryTimeRows(for date: Date, in zone: TimeZone) -> [BinaryRow] {
        let values = hourMinuteSecond(for: date, in: zone)
        let hourValue: Int
        if use24Hour {
            hourValue = values.hour
        } else {
            let adjusted = values.hour % 12
            hourValue = adjusted == 0 ? 12 : adjusted
        }

        var rows = [
            BinaryRow(label: "H", value: hourValue, bits: binaryBits(for: hourValue, width: 5)),
            BinaryRow(label: "M", value: values.minute, bits: binaryBits(for: values.minute, width: 6))
        ]

        if showSeconds {
            rows.append(BinaryRow(label: "S", value: values.second, bits: binaryBits(for: values.second, width: 6)))
        }
        return rows
    }

    private func binaryBits(for value: Int, width: Int) -> [Bool] {
        (0..<width).reversed().map { index in
            (value & (1 << index)) != 0
        }
    }

    private func formattedTime(_ date: Date, in zone: TimeZone, includeSeconds: Bool) -> String {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = zone
        if use24Hour {
            formatter.dateFormat = includeSeconds ? "HH:mm:ss" : "HH:mm"
        } else {
            formatter.dateFormat = includeSeconds ? "hh:mm:ss a" : "hh:mm a"
        }
        return formatter.string(from: date)
    }

    private func formattedDate(_ date: Date, in zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = zone
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func formattedWeekday(_ date: Date, in zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = zone
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private func formattedDayNumber(_ date: Date, in zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = zone
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private func timeZoneShortName(_ date: Date, in zone: TimeZone) -> String {
        zone.abbreviation(for: date) ?? zone.identifier
    }

    private func timeZoneDisplayName(_ zoneID: String) -> String {
        TimeCardPreferences.timeZoneDisplayName(zoneID)
    }

    private func normalizeStoredClockSettings() {
        if TimeCardClockPresentation(rawValue: clockPresentationRaw) == nil {
            clockPresentationRaw = TimeCardClockPresentation.digital.rawValue
        }
        if TimeCardDigitalClockStyle(rawValue: digitalStyleRaw) == nil {
            digitalStyleRaw = TimeCardDigitalClockStyle.stacked.rawValue
        }
        if TimeCardAnalogClockStyle(rawValue: analogStyleRaw) == nil {
            analogStyleRaw = TimeCardAnalogClockStyle.railway.rawValue
        }

        let normalizedPrimary = TimeCardPreferences.normalizePrimaryTimeZoneID(selectedTimeZoneID)
        if normalizedPrimary != selectedTimeZoneID {
            selectedTimeZoneID = normalizedPrimary
        }

        let normalizedWorld = TimeCardPreferences.normalizedWorldTimeZoneIDs(
            TimeCardPreferences.decodeWorldTimeZoneIDs(worldTimeZoneIDsRaw),
            primaryZoneID: selectedTimeZoneID
        )
        let encodedWorld = TimeCardPreferences.encodeWorldTimeZoneIDs(normalizedWorld)
        if worldTimeZoneIDsRaw != encodedWorld {
            worldTimeZoneIDsRaw = encodedWorld
        }
    }

    private func dayPeriodText(for date: Date, in zone: TimeZone) -> String {
        let hour = hourMinuteSecond(for: date, in: zone).hour
        switch hour {
        case 5..<12: return "Morning"
        case 12..<17: return "Afternoon"
        case 17..<21: return "Evening"
        default: return "Night"
        }
    }

    private func hourMinuteSecond(for date: Date, in zone: TimeZone) -> (hour: Int, minute: Int, second: Int) {
        var calendar = Calendar.autoupdatingCurrent
        calendar.timeZone = zone
        let c = calendar.dateComponents([.hour, .minute, .second], from: date)
        return (
            hour: c.hour ?? 0,
            minute: c.minute ?? 0,
            second: c.second ?? 0
        )
    }
}

private struct BinaryRow {
    let label: String
    let value: Int
    let bits: [Bool]
}

private struct AnalogClockFace: View {
    let date: Date
    let timeZone: TimeZone
    let style: TimeCardAnalogClockStyle
    let showSecondHand: Bool

    private var components: (hour: Int, minute: Int, second: Int) {
        var calendar = Calendar.autoupdatingCurrent
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.hour, .minute, .second], from: date)
        return (c.hour ?? 0, c.minute ?? 0, c.second ?? 0)
    }

    private var hourAngle: Angle {
        let value = Double(components.hour % 12) + Double(components.minute) / 60.0
        return .degrees(value * 30.0)
    }

    private var minuteAngle: Angle {
        let value = Double(components.minute) + Double(components.second) / 60.0
        return .degrees(value * 6.0)
    }

    private var secondAngle: Angle {
        .degrees(Double(components.second) * 6.0)
    }

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let radius = side / 2

            ZStack {
                faceBackground
                    .frame(width: side, height: side)

                tickMarks(radius: radius)

                if style == .railway {
                    numerals(radius: radius)
                }

                hand(length: radius * 0.5, width: style == .chronograph ? 7 : 6, color: style == .railway ? Color.black.opacity(0.9) : .primary)
                    .rotationEffect(hourAngle)

                hand(length: radius * 0.72, width: style == .chronograph ? 4 : 3, color: minuteHandColor)
                    .rotationEffect(minuteAngle)

                if showSecondHand {
                    hand(length: radius * 0.8, width: 1.4, color: secondHandColor)
                        .rotationEffect(secondAngle)
                }

                Circle()
                    .fill(centerPinColor)
                    .frame(width: style == .chronograph ? 10 : 8, height: style == .chronograph ? 10 : 8)

                if style == .chronograph {
                    Circle()
                        .stroke(Color.secondary.opacity(0.6), lineWidth: 1)
                        .frame(width: radius * 0.5, height: radius * 0.5)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
        }
    }

    private var faceBackground: some View {
        Group {
            switch style {
            case .railway:
                Circle()
                    .fill(Color(red: 0.97, green: 0.97, blue: 0.95))
                    .overlay(
                        Circle()
                            .stroke(Color.black.opacity(0.28), lineWidth: 2)
                    )
            case .minimal:
                Circle()
                    .fill(.thinMaterial)
                    .overlay(
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [Color.secondary.opacity(0.5), Color.secondary.opacity(0.15)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 8
                            )
                    )
            case .chronograph:
                Circle()
                    .fill(.regularMaterial)
                    .overlay(
                        Circle()
                            .stroke(Color.secondary.opacity(0.45), lineWidth: 3)
                    )
            }
        }
    }

    private func tickMarks(radius: CGFloat) -> some View {
        ZStack {
            ForEach(0..<60, id: \.self) { tick in
                Rectangle()
                    .fill(tickMarkColor(forMajor: tick % 5 == 0))
                    .frame(
                        width: style == .minimal ? (tick % 5 == 0 ? 2.5 : 1.2) : (tick % 5 == 0 ? 2 : 1),
                        height: tick % 5 == 0 ? radius * 0.11 : radius * 0.05
                    )
                    .offset(y: -radius + (tick % 5 == 0 ? radius * 0.09 : radius * 0.05))
                    .rotationEffect(.degrees(Double(tick) * 6))
            }
        }
    }

    private func numerals(radius: CGFloat) -> some View {
        ZStack {
            numeral("12", at: .degrees(0), radius: radius)
            numeral("3", at: .degrees(90), radius: radius)
            numeral("6", at: .degrees(180), radius: radius)
            numeral("9", at: .degrees(270), radius: radius)
        }
    }

    private func numeral(_ text: String, at angle: Angle, radius: CGFloat) -> some View {
        let inset = radius * 0.24
        let x = sin(angle.radians) * (radius - inset)
        let y = -cos(angle.radians) * (radius - inset)
        return Text(text)
            .font(.system(size: radius * 0.14, weight: .medium, design: .rounded))
            .foregroundStyle(style == .railway ? Color.black.opacity(0.9) : .primary)
            .offset(x: x, y: y)
    }

    private func hand(length: CGFloat, width: CGFloat, color: Color) -> some View {
        Rectangle()
            .fill(color)
            .frame(width: width, height: length)
            .offset(y: -length / 2)
    }

    private var minuteHandColor: Color {
        switch style {
        case .railway:
            return Color.black.opacity(0.78)
        case .minimal:
            return .secondary
        case .chronograph:
            return .primary
        }
    }

    private var secondHandColor: Color {
        style == .minimal ? .red.opacity(0.65) : .red.opacity(0.85)
    }

    private var centerPinColor: Color {
        switch style {
        case .railway:
            return Color.black.opacity(0.88)
        case .chronograph:
            return .secondary
        case .minimal:
            return .primary
        }
    }

    private func tickMarkColor(forMajor isMajor: Bool) -> Color {
        switch style {
        case .railway:
            return isMajor ? Color.black.opacity(0.9) : Color.black.opacity(0.55)
        case .minimal:
            return isMajor ? Color.primary.opacity(0.7) : Color.secondary.opacity(0.55)
        case .chronograph:
            return isMajor ? Color.primary.opacity(0.9) : Color.secondary.opacity(0.55)
        }
    }
}

private struct SegmentTextField: NSViewRepresentable {
    @Binding var text: String
    var font: NSFont = NSFont.monospacedSystemFont(ofSize: 48, weight: .light)
    var onCommit: () -> Void
    var onCancel: () -> Void

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField()
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.alignment = .center
        field.font = font
        field.delegate = context.coordinator
        field.stringValue = text
        // Become first responder on next run loop to ensure the view is in the window
        DispatchQueue.main.async {
            field.window?.makeFirstResponder(field)
            field.currentEditor()?.selectAll(nil)
        }
        return field
    }

    func updateNSView(_ nsView: NSTextField, context: Context) {
        if nsView.stringValue != text {
            nsView.stringValue = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, NSTextFieldDelegate {
        let parent: SegmentTextField

        init(_ parent: SegmentTextField) {
            self.parent = parent
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            // Only allow digits, max 2 characters
            let filtered = String(field.stringValue.filter(\.isWholeNumber).prefix(2))
            field.stringValue = filtered
            parent.text = filtered
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                parent.onCommit()
                return true
            }
            if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
                parent.onCancel()
                return true
            }
            if commandSelector == #selector(NSResponder.insertTab(_:)) {
                parent.onCommit()
                return true
            }
            return false
        }
    }
}

#Preview {
    TimerView(config: .constant(.default), timerService: TimerService())
        .frame(width: 400, height: 400)
}
