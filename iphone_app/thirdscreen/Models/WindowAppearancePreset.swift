//
//  WindowAppearancePreset.swift
//  thirdscreen
//

import AppKit

enum WindowTransparencyPreset: Int, CaseIterable, Identifiable {
    case solid = 0
    case balanced = 1
    case translucent = 2
    case airy = 3

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .solid: return "Solid"
        case .balanced: return "Balanced"
        case .translucent: return "Translucent"
        case .airy: return "Airy"
        }
    }

    var opacityPercent: Double {
        switch self {
        case .solid: return 100
        case .balanced: return 80
        case .translucent: return 65
        case .airy: return 50
        }
    }
}

enum WindowBlurPreset: Int, CaseIterable, Identifiable {
    case subtle = 0
    case regular = 1
    case strong = 2

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .subtle: return "Subtle"
        case .regular: return "Regular"
        case .strong: return "Strong"
        }
    }

    var material: NSVisualEffectView.Material {
        switch self {
        case .subtle: return .underWindowBackground
        case .regular: return .windowBackground
        case .strong: return .hudWindow
        }
    }
}
