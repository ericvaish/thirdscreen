import Foundation
import IOKit
import IOKit.ps
import CoreBluetooth

struct InternalBatteryInfo: Equatable {
    let name: String
    let percent: Int
    let isCharging: Bool
    let isCharged: Bool
    let isOnACPower: Bool
    let timeToEmptyMinutes: Int?
    let timeToFullMinutes: Int?
}

enum BluetoothDeviceType: Equatable {
    case earbudLeft
    case earbudRight
    case chargingCase
    case mouse
    case keyboard
    case headphones
    case generic
}

struct BluetoothBatteryInfo: Identifiable, Equatable {
    let id: String
    let name: String
    let percent: Int
    var deviceType: BluetoothDeviceType = .generic
    var isCharging: Bool = false
}

struct BatterySnapshot: Equatable {
    let internalBattery: InternalBatteryInfo?
    let bluetoothBatteries: [BluetoothBatteryInfo]
    let refreshedAt: Date

    static var empty: BatterySnapshot {
        BatterySnapshot(internalBattery: nil, bluetoothBatteries: [], refreshedAt: .now)
    }
}

// MARK: - BLE Battery Scanner

final class BLEBatteryScanner: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var centralManager: CBCentralManager!
    private var discoveredDevices: [String: BluetoothBatteryInfo] = [:]
    private var pendingPeripherals: Set<CBPeripheral> = []
    private var connectedPeripherals: Set<CBPeripheral> = []
    private let scanDuration: TimeInterval = 4
    private var completion: (([BluetoothBatteryInfo]) -> Void)?
    private var hasFinished = false

    private static let batteryServiceUUID = CBUUID(string: "180F")
    private static let batteryLevelUUID = CBUUID(string: "2A19")
    private static let hidServiceUUID = CBUUID(string: "1812")
    private static let appleCompanyID: UInt16 = 0x004C

    private static let appleAudioModels: [String: String] = [
        "0220": "AirPods",
        "0F20": "AirPods 2",
        "1320": "AirPods 3",
        "1420": "AirPods Pro 2",
        "0E20": "AirPods Pro",
        "2420": "AirPods Pro 2",
        "0A20": "AirPods Max",
        "1220": "AirPods Max",
        "0620": "Beats Solo 3",
        "0920": "Beats Studio 3",
        "1020": "Beats Flex",
        "0B20": "Powerbeats 3",
        "0C20": "Powerbeats Pro",
        "1120": "Beats Studio Buds",
        "0520": "BeatsX",
    ]

    func scan(completion: @escaping ([BluetoothBatteryInfo]) -> Void) {
        self.completion = completion
        self.discoveredDevices = [:]
        self.pendingPeripherals = []
        self.connectedPeripherals = []
        self.hasFinished = false
        centralManager = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn else {
            if central.state == .unauthorized || central.state == .unsupported || central.state == .poweredOff {
                finishScan()
            }
            return
        }

        // 1. Read battery from already-connected BLE peripherals (e.g. Logitech mice/keyboards)
        let connected = central.retrieveConnectedPeripherals(withServices: [Self.batteryServiceUUID, Self.hidServiceUUID])
        for peripheral in connected {
            guard peripheral.name != nil, !peripheral.name!.isEmpty else { continue }
            connectedPeripherals.insert(peripheral)
            peripheral.delegate = self
            central.connect(peripheral)
        }

        // 2. Scan for BLE advertisements (AirPods, Beats, other advertising devices)
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])

        DispatchQueue.main.asyncAfter(deadline: .now() + scanDuration) { [weak self] in
            self?.finishScan()
        }
    }

    // MARK: - Advertisement Parsing

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                         advertisementData: [String: Any], rssi RSSI: NSNumber) {
        if let mfgData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data,
           mfgData.count >= 2 {
            let companyID = UInt16(mfgData[0]) | (UInt16(mfgData[1]) << 8)
            if companyID == Self.appleCompanyID {
                parseAppleAdvertisement(data: mfgData, rssi: RSSI.intValue)
                return
            }
        }
    }

    private func parseAppleAdvertisement(data: Data, rssi: Int) {
        guard rssi > -70, data.count >= 3 else { return }

        let messageType = data[2]

        if messageType == 0x07, data.count >= 19 {
            parseLidOpenPacket(data: data)
        } else if messageType == 0x12, data.count >= 17 {
            parseLidClosedPacket(data: data)
        }
    }

    private func parseLidOpenPacket(data: Data) {
        let modelHex = String(format: "%02X%02X", data[5], data[6])
        let modelName = Self.appleAudioModels[modelHex]

        guard modelName != nil || data.count >= 19 else { return }
        let name = modelName ?? "Apple Audio Device"

        guard data.count > 16 else { return }

        let rawLeft = Int(data[14])
        let rawRight = Int(data[15])
        let rawCase = Int(data[16])

        let leftResult = decodeBatteryByte(rawLeft)
        let rightResult = decodeBatteryByte(rawRight)
        let caseResult = decodeBatteryByte(rawCase)

        let key = name.lowercased()

        if let left = leftResult {
            discoveredDevices["\(key)-left"] = BluetoothBatteryInfo(
                id: "\(modelHex)-left-ble",
                name: "\(name) Left",
                percent: left.percent,
                deviceType: .earbudLeft,
                isCharging: left.isCharging
            )
        }

        if let right = rightResult {
            discoveredDevices["\(key)-right"] = BluetoothBatteryInfo(
                id: "\(modelHex)-right-ble",
                name: "\(name) Right",
                percent: right.percent,
                deviceType: .earbudRight,
                isCharging: right.isCharging
            )
        }

        if let caseVal = caseResult {
            discoveredDevices["\(key)-case"] = BluetoothBatteryInfo(
                id: "\(modelHex)-case-ble",
                name: "\(name) Case",
                percent: caseVal.percent,
                deviceType: .chargingCase,
                isCharging: caseVal.isCharging
            )
        }
    }

    private func parseLidClosedPacket(data: Data) {
        let modelHex = String(format: "%02X%02X", data[5], data[6])
        guard let modelName = Self.appleAudioModels[modelHex] else { return }

        guard data.count > 14 else { return }

        let rawCase = Int(data[12])
        let rawLeft = Int(data[13])
        let rawRight = Int(data[14])

        let leftResult = decodeBatteryByte(rawLeft)
        let rightResult = decodeBatteryByte(rawRight)
        let caseResult = decodeBatteryByte(rawCase)

        let key = modelName.lowercased()

        if let left = leftResult {
            discoveredDevices["\(key)-left"] = BluetoothBatteryInfo(
                id: "\(modelHex)-left-ble",
                name: "\(modelName) Left",
                percent: left.percent,
                deviceType: .earbudLeft,
                isCharging: left.isCharging
            )
        }

        if let right = rightResult {
            discoveredDevices["\(key)-right"] = BluetoothBatteryInfo(
                id: "\(modelHex)-right-ble",
                name: "\(modelName) Right",
                percent: right.percent,
                deviceType: .earbudRight,
                isCharging: right.isCharging
            )
        }

        if let caseVal = caseResult {
            discoveredDevices["\(key)-case"] = BluetoothBatteryInfo(
                id: "\(modelHex)-case-ble",
                name: "\(modelName) Case",
                percent: caseVal.percent,
                deviceType: .chargingCase,
                isCharging: caseVal.isCharging
            )
        }
    }

    private func decodeBatteryByte(_ value: Int) -> (percent: Int, isCharging: Bool)? {
        if value == 0xFF || value == 255 { return nil }
        let charging = value > 100
        let percent = charging ? (value ^ 0x80) : value
        guard percent >= 0, percent <= 100 else { return nil }
        return (percent, charging)
    }

    // MARK: - GATT Battery Service (connected peripherals)

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([Self.batteryServiceUUID])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: (any Error)?) {
        pendingPeripherals.remove(peripheral)
        connectedPeripherals.remove(peripheral)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: (any Error)?) {
        guard let services = peripheral.services else {
            cleanupPeripheral(peripheral)
            return
        }
        var foundBattery = false
        for service in services where service.uuid == Self.batteryServiceUUID {
            peripheral.discoverCharacteristics([Self.batteryLevelUUID], for: service)
            foundBattery = true
        }
        if !foundBattery {
            cleanupPeripheral(peripheral)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: (any Error)?) {
        guard let characteristics = service.characteristics else {
            cleanupPeripheral(peripheral)
            return
        }
        var foundLevel = false
        for characteristic in characteristics where characteristic.uuid == Self.batteryLevelUUID {
            peripheral.readValue(for: characteristic)
            foundLevel = true
        }
        if !foundLevel {
            cleanupPeripheral(peripheral)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: (any Error)?) {
        if characteristic.uuid == Self.batteryLevelUUID,
           let data = characteristic.value, !data.isEmpty {
            let percent = Int(data[0])
            let name = peripheral.name ?? "Bluetooth Device"
            let key = name.lowercased()
            if percent >= 0, percent <= 100 {
                discoveredDevices[key] = BluetoothBatteryInfo(
                    id: "\(peripheral.identifier.uuidString)-gatt",
                    name: name,
                    percent: percent,
                    deviceType: Self.inferDeviceType(from: name)
                )
            }
        }
        cleanupPeripheral(peripheral)
    }

    static func inferDeviceType(from name: String) -> BluetoothDeviceType {
        let lower = name.lowercased()
        if lower.contains("mouse") || lower.contains("mx master") {
            return .mouse
        }
        if lower.contains("keyboard") || lower.contains("mchncl") || lower.contains("keys") {
            return .keyboard
        }
        return .generic
    }

    private func cleanupPeripheral(_ peripheral: CBPeripheral) {
        if connectedPeripherals.contains(peripheral) {
            connectedPeripherals.remove(peripheral)
        } else {
            centralManager?.cancelPeripheralConnection(peripheral)
        }
        pendingPeripherals.remove(peripheral)
    }

    private func finishScan() {
        guard !hasFinished else { return }
        hasFinished = true
        centralManager?.stopScan()
        for peripheral in pendingPeripherals {
            centralManager?.cancelPeripheralConnection(peripheral)
        }
        pendingPeripherals.removeAll()

        let results = Array(discoveredDevices.values).sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        completion?(results)
        completion = nil
    }
}

// MARK: - BLE Scanner Singleton

final class BLEBatteryScannerManager {
    static let shared = BLEBatteryScannerManager()
    /// Devices seen recently, keyed by lowercased name. Value includes last-seen time.
    private var deviceCache: [String: (info: BluetoothBatteryInfo, lastSeen: Date)] = [:]
    /// How long to keep a device visible after it was last seen in a scan.
    private let cacheExpiry: TimeInterval = 5 * 60 // 5 minutes
    private var isScanning = false
    private var activeScanner: BLEBatteryScanner?

    func latestBatteries() -> [BluetoothBatteryInfo] {
        triggerScanIfNeeded()
        // Return all non-expired cached entries
        let now = Date.now
        return deviceCache.values
            .filter { now.timeIntervalSince($0.lastSeen) < cacheExpiry }
            .map(\.info)
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func triggerScanIfNeeded() {
        guard !isScanning else { return }
        isScanning = true

        let scanner = BLEBatteryScanner()
        activeScanner = scanner
        scanner.scan { [weak self] results in
            DispatchQueue.main.async {
                guard let self else { return }
                let now = Date.now
                // Update cache with fresh scan results
                for device in results {
                    let key = device.name.lowercased()
                    self.deviceCache[key] = (info: device, lastSeen: now)
                }
                // Prune expired entries
                self.deviceCache = self.deviceCache.filter {
                    now.timeIntervalSince($0.value.lastSeen) < self.cacheExpiry
                }
                self.isScanning = false
                self.activeScanner = nil
            }
        }
    }
}

// MARK: - BatteryService

enum BatteryService {
    static func ensureBluetoothPermission() {
        _ = BLEBatteryScannerManager.shared.latestBatteries()
    }

    static func snapshot() -> BatterySnapshot {
        let internalBattery = readInternalBattery()
        let bleBatteries = BLEBatteryScannerManager.shared.latestBatteries()
        let ioRegistryBatteries = readBluetoothBatteriesFromIORegistry()
        let powerSourceBatteries = readBluetoothBatteriesFromPowerSources()

        var merged = mergedBluetoothBatteries(primary: ioRegistryBatteries, secondary: powerSourceBatteries)
        merged = mergedBluetoothBatteries(primary: merged, secondary: bleBatteries)

        return BatterySnapshot(
            internalBattery: internalBattery,
            bluetoothBatteries: merged,
            refreshedAt: .now
        )
    }

    // MARK: - Internal Battery

    private static func readInternalBattery() -> InternalBatteryInfo? {
        guard let infoBlob = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(infoBlob)?.takeRetainedValue() as? [CFTypeRef] else {
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

    // MARK: - IORegistry Bluetooth Batteries

    private static func readBluetoothBatteriesFromIORegistry() -> [BluetoothBatteryInfo] {
        guard let matching = IOServiceMatching("AppleDeviceManagementHIDEventService") else {
            return []
        }

        var iterator: io_iterator_t = 0
        let status = IOServiceGetMatchingServices(kIOMainPortDefault, matching, &iterator)
        guard status == KERN_SUCCESS else { return [] }
        defer { IOObjectRelease(iterator) }

        var batteries: [BluetoothBatteryInfo] = []
        var seenKeys = Set<String>()

        while true {
            let service = IOIteratorNext(iterator)
            guard service != 0 else { break }
            defer { IOObjectRelease(service) }

            var propertiesRef: Unmanaged<CFMutableDictionary>?
            guard IORegistryEntryCreateCFProperties(service, &propertiesRef, kCFAllocatorDefault, 0) == KERN_SUCCESS,
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
                  let percent = normalizedPercentage(rawBattery) else { continue }

            let address = bluetoothAddressString(from: properties["DeviceAddress"])
                ?? stringValue(from: properties["SerialNumber"])

            let key = normalizedDeviceName(name)
            guard seenKeys.insert(key).inserted else {
                if let index = batteries.firstIndex(where: { normalizedDeviceName($0.name) == key }),
                   batteries[index].percent == 0, percent > 0 {
                    batteries[index] = BluetoothBatteryInfo(id: batteries[index].id, name: batteries[index].name, percent: percent, deviceType: batteries[index].deviceType, isCharging: batteries[index].isCharging)
                }
                continue
            }

            batteries.append(BluetoothBatteryInfo(id: "\(address ?? name)-ioreg", name: name, percent: percent, deviceType: BLEBatteryScanner.inferDeviceType(from: name)))
        }

        return batteries.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    // MARK: - Power Source Bluetooth Batteries

    private static func readBluetoothBatteriesFromPowerSources() -> [BluetoothBatteryInfo] {
        guard let infoBlob = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(infoBlob)?.takeRetainedValue() as? [CFTypeRef] else {
            return []
        }

        var batteries: [BluetoothBatteryInfo] = []
        for (index, source) in sources.enumerated() {
            guard let desc = IOPSGetPowerSourceDescription(infoBlob, source)?.takeUnretainedValue() as? [String: Any],
                  let battery = bluetoothBatteryInfo(fromPowerSource: desc, fallbackID: "\(index)") else { continue }
            guard !shouldIgnoreAsBatteryDevice(name: battery.name) else { continue }
            batteries.append(battery)
        }

        return batteries.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func bluetoothBatteryInfo(fromPowerSource sourceDescription: [String: Any], fallbackID: String) -> BluetoothBatteryInfo? {
        guard bluetoothPowerSourceLooksLikeAccessory(sourceDescription),
              let percent = percentage(fromPowerSource: sourceDescription) else { return nil }

        let rawName = (sourceDescription[kIOPSNameKey as String] as? String) ?? "Bluetooth Device"
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = name.isEmpty ? "Bluetooth Device" : name
        let serialNumber = (sourceDescription[kIOPSHardwareSerialNumberKey as String] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let baseID = (serialNumber?.isEmpty == false ? serialNumber : nil) ?? displayName

        return BluetoothBatteryInfo(id: "\(baseID)-\(fallbackID)", name: displayName, percent: percent, deviceType: BLEBatteryScanner.inferDeviceType(from: displayName))
    }

    static func bluetoothPowerSourceLooksLikeAccessory(_ sourceDescription: [String: Any]) -> Bool {
        let sourceType = (sourceDescription[kIOPSTypeKey as String] as? String) ?? ""
        if sourceType == (kIOPSInternalBatteryType as String) || sourceType == (kIOPSUPSType as String) {
            return false
        }

        let normalizedTransport = ((sourceDescription[kIOPSTransportTypeKey as String] as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if normalizedTransport == (kIOPSInternalType as String).lowercased() { return false }
        if normalizedTransport.isEmpty { return sourceType.lowercased().contains("accessory") }
        return normalizedTransport.contains("bluetooth")
    }

    // MARK: - Merge

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
            if let existing = mergedByName[key] {
                if existing.percent == 0 && battery.percent > 0 {
                    mergedByName[key] = BluetoothBatteryInfo(id: existing.id, name: existing.name, percent: battery.percent, deviceType: existing.deviceType, isCharging: existing.isCharging || battery.isCharging)
                }
            } else {
                mergedByName[key] = battery
            }
        }

        return Array(mergedByName.values).sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    // MARK: - Helpers

    private static func shouldIgnoreAsBatteryDevice(name: String) -> Bool {
        let n = normalizedDeviceName(name)
        guard !n.isEmpty else { return false }
        return ["iphone", "ipad", "apple watch", "mac mini", "macbook", "imac", "mac studio", "mac pro"]
            .contains(where: { n.contains($0) })
    }

    private static func percentage(fromPowerSource s: [String: Any]) -> Int? {
        if let current = s[kIOPSCurrentCapacityKey as String] as? Int,
           let max = s[kIOPSMaxCapacityKey as String] as? Int, max > 0 {
            return normalizedPercentage(Int((Double(current) / Double(max) * 100).rounded()))
        }
        if let direct = s[kIOPSCurrentCapacityKey as String] as? Int {
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

    private static func integerValue(from value: Any?) -> Int? {
        switch value {
        case let i as Int: return i
        case let n as NSNumber: return n.intValue
        case let s as String: return Int(s.trimmingCharacters(in: .whitespacesAndNewlines))
        default: return nil
        }
    }

    private static func stringValue(from value: Any?) -> String? {
        switch value {
        case let s as String:
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        case let n as NSNumber: return n.stringValue
        default: return nil
        }
    }

    private static func bluetoothAddressString(from value: Any?) -> String? {
        if let s = value as? String {
            let n = s.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "-", with: ":").uppercased()
            return n.isEmpty ? nil : n
        }
        if let d = value as? Data, !d.isEmpty {
            return d.map { String(format: "%02X", $0) }.joined(separator: ":")
        }
        return nil
    }

    private static func normalizedDeviceDisplayName(_ rawName: String?) -> String {
        let t = rawName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return t.isEmpty ? "Bluetooth Device" : t
    }

    private static func normalizedDeviceName(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
