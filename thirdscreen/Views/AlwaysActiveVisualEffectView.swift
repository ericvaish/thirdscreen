//
//  AlwaysActiveVisualEffectView.swift
//  thirdscreen
//

import SwiftUI
import AppKit

/// A reusable NSVisualEffectView for applying native macOS window blur materials.
struct AlwaysActiveVisualEffectView: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .underWindowBackground
    var blendingMode: NSVisualEffectView.BlendingMode = .behindWindow
    var state: NSVisualEffectView.State = .active
    var opacity: Double = 72

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = state
        view.alphaValue = max(0, min(1, opacity / 100))
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
        nsView.state = state
        nsView.alphaValue = max(0, min(1, opacity / 100))
    }
}
