import Foundation

struct ShortcutQuickAction: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var symbolName: String

    init(id: UUID = UUID(), name: String, symbolName: String = "bolt.fill") {
        self.id = id
        self.name = name
        self.symbolName = symbolName
    }
}
