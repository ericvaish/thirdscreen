import SwiftUI

struct BatteryView: View {
    @State private var snapshot = BatterySnapshot.empty

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let internalBattery = snapshot.internalBattery {
                internalBatterySection(internalBattery)
            }

            bluetoothBatterySection

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
            Text("Bluetooth Devices")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

            if snapshot.bluetoothBatteries.isEmpty {
                Text("No connected Bluetooth device batteries were found.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 12)], spacing: 12) {
                        ForEach(snapshot.bluetoothBatteries) { device in
                            BatteryGaugeView(info: device)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func refreshLoop() async {
        // Trigger initial BLE scan
        BatteryService.ensureBluetoothPermission()
        // Wait for BLE scan to complete (~4s scan + buffer)
        try? await Task.sleep(for: .seconds(6))
        snapshot = BatteryService.snapshot()

        while !Task.isCancelled {
            // Trigger new BLE scan
            BatteryService.ensureBluetoothPermission()
            // Wait for scan to complete, then read results
            try? await Task.sleep(for: .seconds(6))
            guard !Task.isCancelled else { break }
            snapshot = BatteryService.snapshot()
            // Wait remaining interval before next scan
            try? await Task.sleep(for: .seconds(39))
            guard !Task.isCancelled else { break }
        }
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
                return "Charging \u{2022} \(duration) until full"
            }
            return "Charging"
        }

        if let duration = formattedDuration(minutes: battery.timeToEmptyMinutes) {
            return "On battery \u{2022} \(duration) remaining"
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

// MARK: - Battery Gauge View

private struct BatteryGaugeView: View {
    let info: BluetoothBatteryInfo

    private var ringColor: Color {
        switch info.percent {
        case 41...: return .green
        case 21...40: return .yellow
        default: return .red
        }
    }

    private var iconName: String {
        switch info.deviceType {
        case .earbudLeft:
            return "airpodpro.left"
        case .earbudRight:
            return "airpodpro.right"
        case .chargingCase:
            return "airpods.chargingcase.fill"
        case .mouse:
            return "computermouse.fill"
        case .keyboard:
            return "keyboard.fill"
        case .headphones:
            return "headphones"
        case .generic:
            return "dot.radiowaves.left.and.right"
        }
    }

    private var shortLabel: String {
        let name = info.name
        if name.hasSuffix(" Left") { return "Left" }
        if name.hasSuffix(" Right") { return "Right" }
        if name.hasSuffix(" Case") { return "Case" }
        // For non-AirPods devices, truncate if needed
        if name.count > 12 {
            return String(name.prefix(10)) + "\u{2026}"
        }
        return name
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Background ring
                Circle()
                    .stroke(ringColor.opacity(0.2), lineWidth: 4)

                // Progress ring
                Circle()
                    .trim(from: 0, to: CGFloat(info.percent) / 100)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .shadow(color: ringColor.opacity(0.4), radius: 4)

                // Icon
                Image(systemName: iconName)
                    .font(.system(size: 18))
                    .foregroundStyle(ringColor)

                // Charging bolt overlay
                if info.isCharging {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.yellow)
                        .background(
                            Circle()
                                .fill(.black.opacity(0.6))
                                .frame(width: 14, height: 14)
                        )
                        .offset(x: 20, y: -20)
                }
            }
            .frame(width: 52, height: 52)

            Text("\(info.percent)%")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(.primary)

            Text(shortLabel)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    BatteryView()
}
