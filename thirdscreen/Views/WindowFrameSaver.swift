//
//  WindowFrameSaver.swift
//  thirdscreen
//

import SwiftUI
import AppKit

private let frameAutosaveName = "MainWindow"

/// Ensures the main window's size and position are persisted across hide/show and app restarts.
struct WindowFrameSaver: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            guard let window = view.window else { return }
            window.setFrameAutosaveName(frameAutosaveName)
            // Allow SwiftUI material backgrounds to render with visible translucency.
            window.isOpaque = false
            window.backgroundColor = .clear
            // Keep titlebar in the same translucent layer as the content area.
            window.titlebarAppearsTransparent = true
            // Keep toolbar alignment stable while removing visible app-name text.
            window.title = " "
            window.titleVisibility = .visible
            window.styleMask.insert(.fullSizeContentView)
            if #available(macOS 11.0, *) {
                // Use native unified toolbar treatment instead of a custom vignette.
                window.toolbarStyle = .unified
            }
            // SwiftUI creates the window before our view runs, so we must explicitly restore
            // the saved frame on launch (setFrameAutosaveName alone restores only on re-display).
            if let saved = UserDefaults.standard.string(forKey: "NSWindow Frame \(frameAutosaveName)") {
                window.setFrame(from: saved)
            }
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}
