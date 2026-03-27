import SwiftUI

struct ToastItem: Identifiable {
    let id = UUID()
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String?
    let duration: TimeInterval

    init(
        icon: String = "checkmark.circle.fill",
        iconColor: Color = .green,
        title: String,
        subtitle: String? = nil,
        duration: TimeInterval = 2.5
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.subtitle = subtitle
        self.duration = duration
    }
}

@Observable
final class ToastManager {
    var currentToast: ToastItem?
    private var dismissTask: Task<Void, Never>?

    func show(_ toast: ToastItem) {
        dismissTask?.cancel()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            currentToast = toast
        }
        dismissTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(toast.duration))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.3)) {
                currentToast = nil
            }
        }
    }

    func dismiss() {
        dismissTask?.cancel()
        withAnimation(.easeOut(duration: 0.25)) {
            currentToast = nil
        }
    }
}
