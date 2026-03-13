#if canImport(LocalLLMClient)
import Foundation
import LocalLLMClient

// MARK: - Set Timer Tool (llama.cpp / LocalLLMClient)

struct SetTimerLlamaTool: LLMTool, @unchecked Sendable {
    let name = "set_timer"
    let description = "Set a countdown timer for the specified number of minutes. Only use when the user explicitly asks to set a timer or countdown."

    let timerAction: @Sendable (Int) async -> Void
    let logAction: @Sendable (String, String) async -> Void

    struct Arguments: Decodable, ToolSchemaGeneratable {
        let minutes: Int

        static var argumentsSchema: LLMToolArgumentsSchema {
            ["minutes": .integer(description: "Number of minutes for the timer (1 to 120)")]
        }
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        let clamped = max(1, min(120, arguments.minutes))
        await timerAction(clamped)
        let result = "Timer set for \(clamped) minute\(clamped == 1 ? "" : "s") and started."
        await logAction("set_timer", result)
        return ToolOutput(["message": result])
    }
}

// MARK: - Get Current Time Tool (llama.cpp / LocalLLMClient)

struct GetCurrentTimeLlamaTool: LLMTool, @unchecked Sendable {
    let name = "get_current_time"
    let description = "Get the current date and time. Use when the user asks what time or date it is."

    let logAction: @Sendable (String, String) async -> Void

    struct Arguments: Decodable, ToolSchemaGeneratable {
        static var argumentsSchema: LLMToolArgumentsSchema { [:] }
    }

    func call(arguments: Arguments) async throws -> ToolOutput {
        let now = Date()
        let timeFmt = DateFormatter()
        timeFmt.dateFormat = "h:mm:ss a"
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "EEEE, MMMM d, yyyy"
        let tz = TimeZone.current.identifier
        let result = "Current time: \(timeFmt.string(from: now)), Date: \(dateFmt.string(from: now)), Timezone: \(tz)"
        await logAction("get_current_time", result)
        return ToolOutput([
            "time": timeFmt.string(from: now),
            "date": dateFmt.string(from: now),
            "timezone": tz
        ])
    }
}
#endif
