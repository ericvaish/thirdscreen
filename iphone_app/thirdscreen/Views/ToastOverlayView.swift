import SwiftUI

struct ToastOverlayView: View {
    let toastManager: ToastManager

    var body: some View {
        ZStack {
            if let toast = toastManager.currentToast {
                VStack {
                    HStack(spacing: 12) {
                        Image(systemName: toast.icon)
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(toast.iconColor)
                            .symbolEffect(.bounce, value: toast.id)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(toast.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.primary)

                            if let subtitle = toast.subtitle {
                                Text(subtitle)
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .frame(maxWidth: 320)
                    .background {
                        Capsule()
                            .fill(.ultraThinMaterial)
                            .shadow(color: .black.opacity(0.18), radius: 16, y: 4)
                    }
                    .overlay {
                        Capsule()
                            .strokeBorder(.primary.opacity(0.06), lineWidth: 0.5)
                    }
                    .padding(.top, 12)

                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture { toastManager.dismiss() }
            }
        }
        .allowsHitTesting(toastManager.currentToast != nil)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: toastManager.currentToast?.id)
    }
}
