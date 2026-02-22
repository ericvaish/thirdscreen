import SwiftUI

struct TimeCardClockSettingsEditor: View {
    @Binding var config: TimeCardConfig

    init(config: Binding<TimeCardConfig>) {
        _config = config
    }

    init() {
        _config = .constant(.default)
    }

    private var clockPresentationBinding: Binding<TimeCardClockPresentation> {
        Binding(
            get: { TimeCardClockPresentation(rawValue: config.clockPresentationRaw) ?? .digital },
            set: { config.clockPresentationRaw = $0.rawValue }
        )
    }

    private var digitalStyleBinding: Binding<TimeCardDigitalClockStyle> {
        Binding(
            get: { TimeCardDigitalClockStyle(rawValue: config.digitalStyleRaw) ?? .stacked },
            set: { config.digitalStyleRaw = $0.rawValue }
        )
    }

    private var analogStyleBinding: Binding<TimeCardAnalogClockStyle> {
        Binding(
            get: { TimeCardAnalogClockStyle(rawValue: config.analogStyleRaw) ?? .railway },
            set: { config.analogStyleRaw = $0.rawValue }
        )
    }

    private var showSecondsBinding: Binding<Bool> {
        Binding(
            get: { config.showSeconds },
            set: { config.showSeconds = $0 }
        )
    }

    private var use24HourBinding: Binding<Bool> {
        Binding(
            get: { config.use24Hour },
            set: { config.use24Hour = $0 }
        )
    }

    private var selectedTimeZoneIDBinding: Binding<String> {
        Binding(
            get: { config.selectedTimeZoneID },
            set: { config.selectedTimeZoneID = $0 }
        )
    }

    private var worldTimeZoneIDs: [String] {
        TimeCardPreferences.normalizedWorldTimeZoneIDs(
            TimeCardPreferences.decodeWorldTimeZoneIDs(config.worldTimeZoneIDsRaw),
            primaryZoneID: config.selectedTimeZoneID
        )
    }

    private var availableTimeZoneIDs: [String] {
        TimeCardPreferences.availableTimeZoneIDs(
            primaryZoneID: config.selectedTimeZoneID,
            worldTimeZoneIDs: worldTimeZoneIDs
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Type", selection: clockPresentationBinding) {
                ForEach(TimeCardClockPresentation.allCases) { style in
                    Text(style.rawValue).tag(style)
                }
            }
            .pickerStyle(.segmented)

            VStack(spacing: 8) {
                Toggle("Seconds", isOn: showSecondsBinding)
                    .toggleStyle(.switch)
                    .controlSize(.small)

                Toggle("24h", isOn: use24HourBinding)
                    .toggleStyle(.switch)
                    .controlSize(.small)
            }

            Picker("Primary Zone", selection: selectedTimeZoneIDBinding) {
                ForEach(availableTimeZoneIDs, id: \.self) { zoneID in
                    Text(TimeCardPreferences.timeZoneDisplayName(zoneID)).tag(zoneID)
                }
            }
            .pickerStyle(.menu)

            switch clockPresentationBinding.wrappedValue {
            case .digital:
                Picker("Digital Style", selection: digitalStyleBinding) {
                    ForEach(TimeCardDigitalClockStyle.allCases) { style in
                        Text(style.rawValue).tag(style)
                    }
                }
                .pickerStyle(.menu)
            case .analog:
                Picker("Analog Style", selection: analogStyleBinding) {
                    ForEach(TimeCardAnalogClockStyle.allCases) { style in
                        Text(style.rawValue).tag(style)
                    }
                }
                .pickerStyle(.menu)
            case .world:
                Menu("Add Time Zone") {
                    ForEach(availableTimeZoneIDs.filter { !worldTimeZoneIDs.contains($0) }, id: \.self) { zoneID in
                        Button(TimeCardPreferences.timeZoneDisplayName(zoneID)) {
                            addWorldTimeZone(zoneID)
                        }
                    }
                }
            }

            if clockPresentationBinding.wrappedValue == .world {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(worldTimeZoneIDs, id: \.self) { zoneID in
                            worldZoneChip(zoneID)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .onAppear {
            normalizeStoredValues()
        }
        .onChange(of: config.selectedTimeZoneID) { _, _ in
            persistWorldTimeZones(worldTimeZoneIDs)
        }
    }

    private func normalizeStoredValues() {
        if TimeCardClockPresentation(rawValue: config.clockPresentationRaw) == nil {
            config.clockPresentationRaw = TimeCardClockPresentation.digital.rawValue
        }
        if TimeCardDigitalClockStyle(rawValue: config.digitalStyleRaw) == nil {
            config.digitalStyleRaw = TimeCardDigitalClockStyle.stacked.rawValue
        }
        if TimeCardAnalogClockStyle(rawValue: config.analogStyleRaw) == nil {
            config.analogStyleRaw = TimeCardAnalogClockStyle.railway.rawValue
        }

        let normalizedPrimary = TimeCardPreferences.normalizePrimaryTimeZoneID(config.selectedTimeZoneID)
        if normalizedPrimary != config.selectedTimeZoneID {
            config.selectedTimeZoneID = normalizedPrimary
        }
        persistWorldTimeZones(worldTimeZoneIDs)
    }

    private func addWorldTimeZone(_ zoneID: String) {
        var next = worldTimeZoneIDs
        guard !next.contains(zoneID) else { return }
        next.append(zoneID)
        persistWorldTimeZones(next)
    }

    private func removeWorldTimeZone(_ zoneID: String) {
        var next = worldTimeZoneIDs
        guard next.count > 1 else { return }
        next.removeAll { $0 == zoneID }
        persistWorldTimeZones(next)
    }

    private func persistWorldTimeZones(_ zoneIDs: [String]) {
        let normalized = TimeCardPreferences.normalizedWorldTimeZoneIDs(zoneIDs, primaryZoneID: config.selectedTimeZoneID)
        let encoded = TimeCardPreferences.encodeWorldTimeZoneIDs(normalized)
        if config.worldTimeZoneIDsRaw != encoded {
            config.worldTimeZoneIDsRaw = encoded
        }
    }

    private func worldZoneChip(_ zoneID: String) -> some View {
        HStack(spacing: 6) {
            Text(timeZoneShortName(Date(), zoneID: zoneID))
                .font(.caption.monospaced())

            Text(TimeCardPreferences.timeZoneDisplayName(zoneID))
                .font(.caption)
                .lineLimit(1)

            Button {
                removeWorldTimeZone(zoneID)
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .disabled(worldTimeZoneIDs.count <= 1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(.thinMaterial, in: Capsule())
    }

    private func timeZoneShortName(_ date: Date, zoneID: String) -> String {
        let zone = TimeZone(identifier: zoneID) ?? .current
        return zone.abbreviation(for: date) ?? zone.identifier
    }
}
