import Foundation
import IOKit
import IOKit.ps

struct InternalBatteryInfo: Equatable {
    let name: String
    let percent: Int
    let isCharging: Bool
    let isCharged: Bool
    let isOnACPower: Bool
    let timeToEmptyMinutes: Int?
    let timeToFullMinutes: Int?
}

struct BluetoothBatteryInfo: Identifiable, Equatable {
    let id: String
    let name: String
    let percent: Int
}

struct BatterySnapshot: Equatable {
    let internalBattery: InternalBatteryInfo?
    let bluetoothBatteries: [BluetoothBatteryInfo]
    let refreshedAt: Date

    static var empty: BatterySnapshot {
        BatterySnapshot(internalBattery: nil, bluetoothBatteries: [], refreshedAt: .now)
    }
}

enum BatteryService {
    private struct BluetoothConnectionHints {
        let addresses: Set<String>
        let names: Set<String>

        var isEmpty: Bool {
            addresses.isEmpty && names.isEmpty
        }
    }

    private static let debugLoggingEnabled: Bool = {
#if DEBUG
        if ProcessInfo.processInfo.environment["BATTERY_DEBUG_LOGS"] == "1" {
            return true
        }
        if UserDefaults.standard.bool(forKey: "BatteryDebugLogsEnabled") {
            return true
        }
        return false
#else
        return false
#endif
    }()

    static func snapshot() -> BatterySnapshot {
        let internalBattery = readInternalBattery()
        let bluetoothBatteries = internalBattery == nil ? readConnectedBluetoothBatteries() : []
        debugLog("snapshot internalBatteryPresent=\(internalBattery != nil) bluetoothCount=\(bluetoothBatteries.count)")
        return BatterySnapshot(
            internalBattery: internalBattery,
            bluetoothBatteries: bluetoothBatteries,
            refreshedAt: .now
        )
    }

    private static func readInternalBattery() -> InternalBatteryInfo? {
        guard let infoBlob = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(infoBlob)?.takeRetainedValue() as? [CFTypeRef] else {
            debugLog("internal battery lookup failed: unable to copy power source info/list")
            return nil
        }

        for source in sources {
            guard let sourceDescription = IOPSGetPowerSourceDescription(infoBlob, source)?.takeUnretainedValue() as? [String: Any],
                  let sourceType = sourceDescription[kIOPSTypeKey as String] as? String,
                  sourceType == (kIOPSInternalBatteryType as String),
                  let percent = percentage(fromPowerSource: sourceDescription) else {
                continue
            }

            let powerSourceState = sourceDescription[kIOPSPowerSourceStateKey as String] as? String ?? ""
            let isCharging = (sourceDescription[kIOPSIsChargingKey as String] as? Bool) ?? false
            let isCharged = (sourceDescription[kIOPSIsChargedKey as String] as? Bool)
                ?? (percent >= 100 && powerSourceState == (kIOPSACPowerValue as String))

            return InternalBatteryInfo(
                name: sourceDescription[kIOPSNameKey as String] as? String ?? "Mac Battery",
                percent: percent,
                isCharging: isCharging,
                isCharged: isCharged,
                isOnACPower: powerSourceState == (kIOPSACPowerValue as String),
                timeToEmptyMinutes: normalizedMinutes(sourceDescription[kIOPSTimeToEmptyKey as String] as? Int),
                timeToFullMinutes: normalizedMinutes(sourceDescription[kIOPSTimeToFullChargeKey as String] as? Int)
            )
        }

        return nil
    }

    private static func readConnectedBluetoothBatteries() -> [BluetoothBatteryInfo] {
        let connectionHints = connectedBluetoothHintsFromSystemProfiler()
        let ioRegistryBatteries = readBluetoothBatteriesFromIORegistry(connectionHints: connectionHints)
        let powerSourceBatteries = readBluetoothBatteriesFromPowerSources(connectionHints: connectionHints)

        debugLog(
            "bluetooth merge sources ioRegistryCount=\(ioRegistryBatteries.count) powerSourceCount=\(powerSourceBatteries.count) hintsAddresses=\(connectionHints.addresses.count) hintsNames=\(connectionHints.names.count)"
        )

        return mergedBluetoothBatteries(primary: ioRegistryBatteries, secondary: powerSourceBatteries)
    }

    private static func connectedBluetoothHintsFromSystemProfiler() -> BluetoothConnectionHints {
        guard let output = runCommand("/usr/sbin/system_profiler", arguments: ["SPBluetoothDataType", "-json"]),
              let data = output.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) else {
            debugLog("system_profiler unavailable; connection hints empty")
            return BluetoothConnectionHints(addresses: [], names: [])
        }

        var addresses = Set<String>()
        var names = Set<String>()
        collectConnectedHints(from: root, addresses: &addresses, names: &names)

        debugLog("system_profiler hints addresses=\(addresses.count) names=\(names.count)")
        return BluetoothConnectionHints(addresses: addresses, names: names)
    }

    private static func collectConnectedHints(from node: Any, addresses: inout Set<String>, names: inout Set<String>) {
        if let dictionary = node as? [String: Any] {
            let connected = boolValue(
                from: dictionary,
                keys: [
                    "device_connected",
                    "Connected",
                    "connected",
                    "is_connected"
                ]
            )

            if connected == true {
                if let address = stringValue(from: dictionary, keys: ["device_address", "Address", "address"]) {
                    addresses.insert(normalizedBluetoothAddress(address))
                }
                if let name = stringValue(from: dictionary, keys: ["_name", "device_title", "device_name", "name"]) {
                    let normalizedName = normalizedDeviceName(name)
                    if !normalizedName.isEmpty {
                        names.insert(normalizedName)
                    }
                }
            }

            for value in dictionary.values {
                collectConnectedHints(from: value, addresses: &addresses, names: &names)
            }
            return
        }

        if let array = node as? [Any] {
            for item in array {
                collectConnectedHints(from: item, addresses: &addresses, names: &names)
            }
        }
    }

    private static func readBluetoothBatteriesFromIORegistry(
        connectionHints: BluetoothConnectionHints
    ) -> [BluetoothBatteryInfo] {
        guard let matching = IOServiceMatching("AppleDeviceManagementHIDEventService") else {
            return []
        }

        var iterator: io_iterator_t = 0
        let status = IOServiceGetMatchingServices(kIOMainPortDefault, matching, &iterator)
        guard status == KERN_SUCCESS else {
            return []
        }
        defer { IOObjectRelease(iterator) }

        var batteries: [BluetoothBatteryInfo] = []
        var seenKeys = Set<String>()

        while true {
            let service = IOIteratorNext(iterator)
            guard service != 0 else { break }
            defer { IOObjectRelease(service) }

            var propertiesRef: Unmanaged<CFMutableDictionary>?
            let propertiesStatus = IORegistryEntryCreateCFProperties(service, &propertiesRef, kCFAllocatorDefault, 0)
            guard propertiesStatus == KERN_SUCCESS,
                  let properties = propertiesRef?.takeRetainedValue() as? [String: Any] else {
                continue
            }

            let name = normalizedDeviceDisplayName(
                stringValue(from: properties["Product"])
                    ?? stringValue(from: properties["Name"])
                    ?? stringValue(from: properties["DeviceName"])
            )
            guard !shouldIgnoreAsBatteryDevice(name: name) else { continue }

            guard let rawBattery = integerValue(from: properties["BatteryPercent"]),
                  let percent = normalizedPercentage(rawBattery) else {
                continue
            }

            let address = bluetoothAddressString(from: properties["DeviceAddress"])
                ?? stringValue(from: properties["SerialNumber"])

            guard shouldKeepDevice(address: address, name: name, connectionHints: connectionHints) else {
                continue
            }

            let key = normalizedDeviceName(name)
            guard seenKeys.insert(key).inserted else {
                if let index = batteries.firstIndex(where: { normalizedDeviceName($0.name) == key }),
                   batteries[index].percent == 0,
                   percent > 0 {
                    batteries[index] = BluetoothBatteryInfo(id: batteries[index].id, name: batteries[index].name, percent: percent)
                }
                continue
            }

            let idBase = address ?? name
            batteries.append(BluetoothBatteryInfo(id: "\(idBase)-ioreg", name: name, percent: percent))
        }

        return batteries.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private static func readBluetoothBatteriesFromPowerSources(
        connectionHints: BluetoothConnectionHints
    ) -> [BluetoothBatteryInfo] {
        guard let infoBlob = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(infoBlob)?.takeRetainedValue() as? [CFTypeRef] else {
            return []
        }

        var batteries: [BluetoothBatteryInfo] = []
        for (index, source) in sources.enumerated() {
            guard let sourceDescription = IOPSGetPowerSourceDescription(infoBlob, source)?.takeUnretainedValue() as? [String: Any],
                  let battery = bluetoothBatteryInfo(fromPowerSource: sourceDescription, fallbackID: "\(index)") else {
                continue
            }

            guard !shouldIgnoreAsBatteryDevice(name: battery.name) else { continue }

            let sourceAddress = normalizedBluetoothAddress(
                (sourceDescription[kIOPSHardwareSerialNumberKey as String] as? String)
                    ?? (sourceDescription[kIOPSNameKey as String] as? String)
                    ?? battery.name
            )

            guard shouldKeepDevice(address: sourceAddress, name: battery.name, connectionHints: connectionHints) else {
                continue
            }

            batteries.append(battery)
        }

        return batteries.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func bluetoothBatteryInfo(fromPowerSource sourceDescription: [String: Any], fallbackID: String) -> BluetoothBatteryInfo? {
        guard bluetoothPowerSourceLooksLikeAccessory(sourceDescription),
              let percent = percentage(fromPowerSource: sourceDescription) else {
            return nil
        }

        let rawName = (sourceDescription[kIOPSNameKey as String] as? String) ?? "Bluetooth Device"
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = name.isEmpty ? "Bluetooth Device" : name
        let serialNumber = (sourceDescription[kIOPSHardwareSerialNumberKey as String] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let baseID = (serialNumber?.isEmpty == false ? serialNumber : nil) ?? displayName

        return BluetoothBatteryInfo(
            id: "\(baseID)-\(fallbackID)",
            name: displayName,
            percent: percent
        )
    }

    static func bluetoothPowerSourceLooksLikeAccessory(_ sourceDescription: [String: Any]) -> Bool {
        let sourceType = (sourceDescription[kIOPSTypeKey as String] as? String) ?? ""
        if sourceType == (kIOPSInternalBatteryType as String) || sourceType == (kIOPSUPSType as String) {
            return false
        }

        let normalizedTransport = ((sourceDescription[kIOPSTransportTypeKey as String] as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        if normalizedTransport == (kIOPSInternalType as String).lowercased() {
            return false
        }
        if normalizedTransport.isEmpty {
            return sourceType.lowercased().contains("accessory")
        }

        return normalizedTransport.contains("bluetooth")
    }

    private static func mergedBluetoothBatteries(
        primary: [BluetoothBatteryInfo],
        secondary: [BluetoothBatteryInfo]
    ) -> [BluetoothBatteryInfo] {
        var mergedByName: [String: BluetoothBatteryInfo] = [:]

        for battery in primary {
            mergedByName[normalizedDeviceName(battery.name)] = battery
        }

        for battery in secondary {
            let key = normalizedDeviceName(battery.name)
            guard let existing = mergedByName[key] else {
                mergedByName[key] = battery
                continue
            }

            if existing.percent == 0 && battery.percent > 0 {
                mergedByName[key] = BluetoothBatteryInfo(id: existing.id, name: existing.name, percent: battery.percent)
            }
        }

        return Array(mergedByName.values).sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private static func shouldIgnoreAsBatteryDevice(name: String) -> Bool {
        let normalizedName = normalizedDeviceName(name)
        guard !normalizedName.isEmpty else { return false }

        let blockedTokens = [
            "iphone",
            "ipad",
            "apple watch",
            "mac mini",
            "macbook",
            "imac",
            "mac studio",
            "mac pro"
        ]
        return blockedTokens.contains(where: { normalizedName.contains($0) })
    }

    private static func shouldKeepDevice(
        address: String?,
        name: String,
        connectionHints: BluetoothConnectionHints
    ) -> Bool {
        guard !connectionHints.isEmpty else { return true }

        if let address, connectionHints.addresses.contains(normalizedBluetoothAddress(address)) {
            return true
        }

        let normalizedName = normalizedDeviceName(name)
        if !normalizedName.isEmpty, connectionHints.names.contains(normalizedName) {
            return true
        }

        return false
    }

    private static func percentage(fromPowerSource sourceDescription: [String: Any]) -> Int? {
        if let current = sourceDescription[kIOPSCurrentCapacityKey as String] as? Int,
           let max = sourceDescription[kIOPSMaxCapacityKey as String] as? Int,
           max > 0 {
            let computed = Int((Double(current) / Double(max) * 100).rounded())
            return normalizedPercentage(computed)
        }

        if let direct = sourceDescription[kIOPSCurrentCapacityKey as String] as? Int {
            return normalizedPercentage(direct)
        }

        return nil
    }

    private static func normalizedMinutes(_ value: Int?) -> Int? {
        guard let value, value > 0 else { return nil }
        return value
    }

    private static func normalizedPercentage(_ value: Int) -> Int? {
        guard value >= 0, value <= 100 else { return nil }
        return value
    }

    private static func parseInteger(from value: String) -> Int? {
        let digits = value.filter(\.isNumber)
        guard !digits.isEmpty else { return nil }
        return Int(digits)
    }

    private static func integerValue(from value: Any?) -> Int? {
        switch value {
        case let intValue as Int:
            return intValue
        case let number as NSNumber:
            return number.intValue
        case let string as String:
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            return Int(trimmed) ?? parseInteger(from: trimmed)
        default:
            return nil
        }
    }

    private static func boolValue(from dictionary: [String: Any], keys: [String]) -> Bool? {
        for key in keys {
            guard let raw = dictionary[key] else { continue }
            if let value = raw as? Bool { return value }
            if let number = raw as? NSNumber { return number.intValue != 0 }
            if let string = raw as? String {
                let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["yes", "true", "1", "connected"].contains(normalized) { return true }
                if ["no", "false", "0", "disconnected"].contains(normalized) { return false }
            }
        }
        return nil
    }

    private static func stringValue(from value: Any?) -> String? {
        switch value {
        case let string as String:
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        case let number as NSNumber:
            return number.stringValue
        default:
            return nil
        }
    }

    private static func stringValue(from dictionary: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = stringValue(from: dictionary[key]) {
                return value
            }
        }
        return nil
    }

    private static func bluetoothAddressString(from value: Any?) -> String? {
        if let string = value as? String {
            let normalized = normalizedBluetoothAddress(string)
            return normalized.isEmpty ? nil : normalized
        }

        if let data = value as? Data, !data.isEmpty {
            return data.map { String(format: "%02X", $0) }.joined(separator: ":")
        }

        return nil
    }

    private static func normalizedDeviceDisplayName(_ rawName: String?) -> String {
        let trimmed = rawName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Bluetooth Device" : trimmed
    }

    private static func normalizedDeviceName(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    nonisolated private static func normalizedBluetoothAddress(_ rawValue: String) -> String {
        let cleaned = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "-", with: ":")
            .uppercased()

        if cleaned.contains(":") {
            return cleaned
        }

        let compact = cleaned.replacingOccurrences(of: " ", with: "")
        guard compact.count == 12 else { return cleaned }

        var components: [String] = []
        var index = compact.startIndex
        for _ in 0..<6 {
            let next = compact.index(index, offsetBy: 2)
            components.append(String(compact[index..<next]))
            index = next
        }
        return components.joined(separator: ":")
    }

    private static func runCommand(_ launchPath: String, arguments: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: launchPath)
        process.arguments = arguments

        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            debugLog("command failed path=\(launchPath) error=\(error.localizedDescription)")
            return nil
        }

        guard process.terminationStatus == 0 else {
            return nil
        }

        let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)
    }

    private static func debugLog(_ message: String) {
#if DEBUG
        guard debugLoggingEnabled else { return }
        NSLog("[BatteryService] %@", message)
#endif
    }
}
