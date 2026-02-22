import XCTest
import IOKit.ps
@testable import thirdscreen

final class BatteryServiceTests: XCTestCase {
    func testAccessoryPowerSourceWithBluetoothTransportIsAccepted() {
        let source: [String: Any] = [
            kIOPSTypeKey as String: "Accessory Battery",
            kIOPSTransportTypeKey as String: "Bluetooth",
            kIOPSCurrentCapacityKey as String: 44,
            kIOPSMaxCapacityKey as String: 100,
            kIOPSNameKey as String: "AirPods Pro"
        ]

        let battery = BatteryService.bluetoothBatteryInfo(fromPowerSource: source, fallbackID: "0")

        XCTAssertEqual(battery?.name, "AirPods Pro")
        XCTAssertEqual(battery?.percent, 44)
    }

    func testUPSAndInternalPowerSourcesAreRejected() {
        let internalSource: [String: Any] = [
            kIOPSTypeKey as String: kIOPSInternalBatteryType as String,
            kIOPSTransportTypeKey as String: kIOPSInternalType as String
        ]
        let upsSource: [String: Any] = [
            kIOPSTypeKey as String: kIOPSUPSType as String,
            kIOPSTransportTypeKey as String: kIOPSUSBTransportType as String
        ]

        XCTAssertFalse(BatteryService.bluetoothPowerSourceLooksLikeAccessory(internalSource))
        XCTAssertFalse(BatteryService.bluetoothPowerSourceLooksLikeAccessory(upsSource))
    }

    func testAccessoryWithoutExplicitTransportIsAccepted() {
        let source: [String: Any] = [
            kIOPSTypeKey as String: "Accessory Battery",
            kIOPSCurrentCapacityKey as String: 55,
            kIOPSMaxCapacityKey as String: 100,
            kIOPSNameKey as String: "Magic Keyboard"
        ]

        XCTAssertTrue(BatteryService.bluetoothPowerSourceLooksLikeAccessory(source))
        XCTAssertNotNil(BatteryService.bluetoothBatteryInfo(fromPowerSource: source, fallbackID: "1"))
    }
}
