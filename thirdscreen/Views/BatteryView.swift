import SwiftUI

struct BatteryView: View {
    @State private var snapshot = BatterySnapshot.empty

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let internalBattery = snapshot.internalBattery {
                internalBatterySection(internalBattery)
            } else {
                bluetoothBatterySection
            }

            Spacer(minLength: 0)

            Text("Updated \(snapshot.refreshedAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            await refreshLoop()
        }
    }

    private func internalBatterySection(_ battery: InternalBatteryInfo) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label(battery.name, systemImage: iconName(for: battery))
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                Spacer()

                Text("\(battery.percent)%")
                    .appScaledSystemFont(size: 34, weight: .semibold, design: .rounded)
                    .monospacedDigit()
                    .foregroundStyle(.primary)
            }

            ProgressView(value: Double(battery.percent), total: 100)
                .progressViewStyle(.linear)

            Text(internalStatusText(for: battery))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private var bluetoothBatterySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Bluetooth Device Batteries", systemImage: "dot.radiowaves.left.and.right")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            if snapshot.bluetoothBatteries.isEmpty {
                Text("No connected Bluetooth device batteries were found.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(snapshot.bluetoothBatteries) { device in
                            bluetoothDeviceRow(device)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func bluetoothDeviceRow(_ device: BluetoothBatteryInfo) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(device.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                Spacer()

                Text("\(device.percent)%")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: Double(device.percent), total: 100)
                .progressViewStyle(.linear)
        }
        .padding(10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    private func refreshLoop() async {
        await refreshSnapshot()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(45))
            guard !Task.isCancelled else { break }
            await refreshSnapshot()
        }
    }

    private func refreshSnapshot() async {
        snapshot = BatteryService.snapshot()
    }

    private func iconName(for battery: InternalBatteryInfo) -> String {
        if battery.isCharging {
            return "battery.100.bolt"
        }
        switch battery.percent {
        case 90...:
            return "battery.100"
        case 65...:
            return "battery.75"
        case 40...:
            return "battery.50"
        case 15...:
            return "battery.25"
        default:
            return "battery.0"
        }
    }

    private func internalStatusText(for battery: InternalBatteryInfo) -> String {
        if battery.isCharged {
            return "Fully charged"
        }

        if battery.isCharging {
            if let duration = formattedDuration(minutes: battery.timeToFullMinutes) {
                return "Charging • \(duration) until full"
            }
            return "Charging"
        }

        if let duration = formattedDuration(minutes: battery.timeToEmptyMinutes) {
            return "On battery • \(duration) remaining"
        }

        return battery.isOnACPower ? "On AC power" : "On battery power"
    }

    private func formattedDuration(minutes: Int?) -> String? {
        guard let minutes, minutes > 0 else { return nil }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours == 0 {
            return "\(remainder)m"
        }
        if remainder == 0 {
            return "\(hours)h"
        }
        return "\(hours)h \(remainder)m"
    }
}

#Preview {
    BatteryView()
}
