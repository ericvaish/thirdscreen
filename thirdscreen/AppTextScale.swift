import SwiftUI

enum AppTextScale {
    static let minScale: Double = 0.8
    static let maxScale: Double = 2.0
    static let step: Double = 0.1
    static let defaultScale: Double = 1.0

    static func clamp(_ value: Double) -> Double {
        min(max(value, minScale), maxScale)
    }

    static func incremented(_ value: Double) -> Double {
        roundedToStep(clamp(value) + step)
    }

    static func decremented(_ value: Double) -> Double {
        roundedToStep(clamp(value) - step)
    }

    static func roundedToStep(_ value: Double) -> Double {
        let rounded = (value / step).rounded() * step
        return clamp(rounded)
    }

    static func percentLabel(for value: Double) -> String {
        "\(Int((clamp(value) * 100).rounded()))%"
    }

    static func dynamicTypeSize(for scale: Double) -> DynamicTypeSize {
        let clamped = clamp(scale)
        let options: [(Double, DynamicTypeSize)] = [
            (0.80, .xSmall),
            (0.88, .small),
            (0.95, .medium),
            (1.00, .large),
            (1.10, .xLarge),
            (1.20, .xxLarge),
            (1.30, .xxxLarge),
            (1.42, .accessibility1),
            (1.54, .accessibility2),
            (1.66, .accessibility3),
            (1.82, .accessibility4),
            (2.00, .accessibility5)
        ]

        return options.min(by: { abs($0.0 - clamped) < abs($1.0 - clamped) })?.1 ?? .large
    }
}

private struct AppTextScaleKey: EnvironmentKey {
    static let defaultValue: Double = AppTextScale.defaultScale
}

extension EnvironmentValues {
    var appTextScale: Double {
        get { self[AppTextScaleKey.self] }
        set { self[AppTextScaleKey.self] = AppTextScale.clamp(newValue) }
    }
}

private struct AppScaledSystemFontModifier: ViewModifier {
    @Environment(\.appTextScale) private var appTextScale
    let size: CGFloat
    let weight: Font.Weight
    let design: Font.Design

    func body(content: Content) -> some View {
        content.font(.system(
            size: size * CGFloat(AppTextScale.clamp(appTextScale)),
            weight: weight,
            design: design
        ))
    }
}

extension View {
    func appScaledSystemFont(
        size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default
    ) -> some View {
        modifier(AppScaledSystemFontModifier(size: size, weight: weight, design: design))
    }
}
