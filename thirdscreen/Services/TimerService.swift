import Foundation
import SwiftUI
import AppKit
import UserNotifications

@Observable
final class TimerService: NSObject, UNUserNotificationCenterDelegate {
    var remainingSeconds: Int = 0
    private(set) var isRunning = false
    private var timer: Timer?
    private var startedDurationSeconds: Int = 0
    var toastManager: ToastManager?

    var formattedTime: String {
        let h = remainingSeconds / 3600
        let m = (remainingSeconds % 3600) / 60
        let s = remainingSeconds % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    override init() {
        super.init()
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    // Allow notifications to show as banners even when the app is in the foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    /// Set duration without starting (for preset buttons).
    func setDuration(minutes: Int) {
        stop()
        remainingSeconds = max(0, minutes) * 60
    }

    /// Set duration and start immediately (for AI tool calls).
    func setTimer(minutes: Int) {
        setDuration(minutes: minutes)
        start()
    }

    func start() {
        guard remainingSeconds > 0, !isRunning else { return }
        isRunning = true
        startedDurationSeconds = remainingSeconds
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.remainingSeconds > 0 {
                    self.remainingSeconds -= 1
                } else {
                    self.timerFinished()
                }
            }
        }
        if let t = timer {
            RunLoop.main.add(t, forMode: .common)
        }
    }

    func pause() {
        timer?.invalidate()
        timer = nil
        isRunning = false
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        isRunning = false
        remainingSeconds = 0
    }

    // MARK: - Timer Completion

    private func timerFinished() {
        let durationLabel = formattedDuration(startedDurationSeconds)
        stop()

        NSSound(named: "Glass")?.play()

        toastManager?.show(ToastItem(
            icon: "bell.fill",
            iconColor: .red,
            title: "Timer Complete",
            subtitle: "\(durationLabel) timer finished",
            duration: 5
        ))

        sendSystemNotification(duration: durationLabel)
    }

    private func formattedDuration(_ totalSeconds: Int) -> String {
        let h = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        if h > 0 {
            return "\(h)h \(m)m"
        }
        return "\(m) min"
    }

    // MARK: - System Notifications

    private func sendSystemNotification(duration: String) {
        let content = UNMutableNotificationContent()
        content.title = "Timer Complete"
        content.body = "Your \(duration) timer has finished."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "timer-complete-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}
