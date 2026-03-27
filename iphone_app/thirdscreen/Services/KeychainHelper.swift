//
//  KeychainHelper.swift
//  thirdscreen
//

import Foundation
import Security

enum KeychainHelper {
    static let spotifyService = "thirdscreen.spotify"
    static let googleService = "thirdscreen.google"

    static func set(_ value: String, forKey key: String, service: String = "thirdscreen") -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        return set(data, forKey: key, service: service)
    }

    static func set(_ value: Data, forKey key: String, service: String = "thirdscreen") -> Bool {
        _ = delete(key: key, service: service)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: value,
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func set(_ value: Date, forKey key: String, service: String = "thirdscreen") -> Bool {
        set(value.timeIntervalSince1970, forKey: key, service: service)
    }

    static func set(_ value: Double, forKey key: String, service: String = "thirdscreen") -> Bool {
        set(String(value), forKey: key, service: service)
    }

    static func string(forKey key: String, service: String = "thirdscreen") -> String? {
        guard let data = data(forKey: key, service: service),
              let string = String(data: data, encoding: .utf8) else { return nil }
        return string
    }

    static func data(forKey key: String, service: String = "thirdscreen") -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return data
    }

    static func date(forKey key: String, service: String = "thirdscreen") -> Date? {
        guard let string = string(forKey: key, service: service),
              let interval = Double(string) else { return nil }
        return Date(timeIntervalSince1970: interval)
    }

    static func delete(key: String, service: String = "thirdscreen") -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess || SecItemDelete(query as CFDictionary) == errSecItemNotFound
    }

    static func delete(keys: [String], service: String = "thirdscreen") {
        for key in keys {
            _ = delete(key: key, service: service)
        }
    }
}
