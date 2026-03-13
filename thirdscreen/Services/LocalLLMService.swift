import Foundation
import SwiftUI
import FoundationModels
import MLX
import MLXLMCommon
import MLXLLM
import MLXVLM
#if canImport(LocalLLMClient)
import LocalLLMClient
import LocalLLMClientLlama
#endif
// ToolSpec is [String: any Sendable] from Tokenizers — use the raw type to avoid transitive import issues

// MARK: - Model Definitions

enum AIModelProvider: String, Codable {
    case appleFoundation
    case mlx
    case ollama
    case llamaCpp
}

struct AIModel: Identifiable, Codable, Hashable {
    let id: String
    let provider: AIModelProvider
    let displayName: String
    let subtitle: String
    let isVLM: Bool
    let huggingFaceRepo: String?
    let ollamaModelName: String?
    let ggufFilename: String?

    var iconName: String {
        switch provider {
        case .appleFoundation: return "sparkles"
        case .mlx: return isVLM ? "eye" : "cpu"
        case .ollama: return "network"
        case .llamaCpp: return "terminal"
        }
    }

    var requiresDownload: Bool { provider == .mlx || provider == .llamaCpp }

    static let appleIntelligence = AIModel(
        id: "apple-foundation",
        provider: .appleFoundation,
        displayName: "Apple Intelligence",
        subtitle: "Built-in on-device model",
        isVLM: false,
        huggingFaceRepo: nil,
        ollamaModelName: nil,
        ggufFilename: nil
    )

    static func mlxModel(repoID: String, displayName: String, subtitle: String, isVLM: Bool) -> AIModel {
        AIModel(
            id: "mlx:\(repoID)",
            provider: .mlx,
            displayName: displayName,
            subtitle: subtitle,
            isVLM: isVLM,
            huggingFaceRepo: repoID,
            ollamaModelName: nil,
            ggufFilename: nil
        )
    }

    static func ollamaModel(name: String, size: String?) -> AIModel {
        let sizeStr = size.map { " (\($0))" } ?? ""
        return AIModel(
            id: "ollama:\(name)",
            provider: .ollama,
            displayName: name,
            subtitle: "Ollama model\(sizeStr)",
            isVLM: false,
            huggingFaceRepo: nil,
            ollamaModelName: name,
            ggufFilename: nil
        )
    }

    static func llamaCppModel(repoID: String, ggufFilename: String, displayName: String, subtitle: String) -> AIModel {
        AIModel(
            id: "gguf:\(repoID)/\(ggufFilename)",
            provider: .llamaCpp,
            displayName: displayName,
            subtitle: subtitle,
            isVLM: false,
            huggingFaceRepo: repoID,
            ollamaModelName: nil,
            ggufFilename: ggufFilename
        )
    }

    /// Default MLX model seeded on first launch for continuity
    static let defaultQwen25VL = AIModel.mlxModel(
        repoID: "mlx-community/Qwen2.5-VL-3B-Instruct-4bit",
        displayName: "Qwen 2.5 VL 3B",
        subtitle: "3B multimodal — text & images, ~2 GB download",
        isVLM: true
    )

    /// Default llama.cpp model — Qwen 2.5 7B with native tool calling
    static let defaultQwen25GGUF = AIModel.llamaCppModel(
        repoID: "Qwen/Qwen2.5-7B-Instruct-GGUF",
        ggufFilename: "qwen2.5-7b-instruct-q4_k_m.gguf",
        displayName: "Qwen 2.5 7B (GGUF)",
        subtitle: "7B tool-calling model, ~4.4 GB download"
    )
}

// MARK: - Errors

enum AIServiceError: LocalizedError {
    case modelNotDownloaded
    case mlxNotAvailable
    case generationFailed(String)
    case downloadFailed(String)
    case modelLoading
    case ollamaNotRunning
    case modelNotFound(String)

    var errorDescription: String? {
        switch self {
        case .modelNotDownloaded: return "Model has not been downloaded yet."
        case .mlxNotAvailable: return "MLX models require the mlx-swift-lm package."
        case .generationFailed(let msg): return msg
        case .downloadFailed(let msg): return "Download failed: \(msg)"
        case .modelLoading: return "Model is still loading, please wait."
        case .ollamaNotRunning: return "Ollama is not running. Start it with `ollama serve`."
        case .modelNotFound(let id): return "Model not found: \(id)"
        }
    }
}

// MARK: - Tool Call Tracking

struct ToolCallEntry: Identifiable, Equatable {
    let id = UUID()
    let toolName: String
    let result: String
    let timestamp: Date

    init(toolName: String, result: String, timestamp: Date = Date()) {
        self.toolName = toolName
        self.result = result
        self.timestamp = timestamp
    }
}

// MARK: - Chat Message

struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: MessageRole
    var content: String
    let imageURL: URL?
    let timestamp: Date
    var toolCalls: [ToolCallEntry]

    enum MessageRole: String {
        case user
        case assistant
    }

    init(id: UUID = UUID(), role: MessageRole, content: String, imageURL: URL? = nil, toolCalls: [ToolCallEntry] = [], timestamp: Date = Date()) {
        self.id = id
        self.role = role
        self.content = content
        self.imageURL = imageURL
        self.toolCalls = toolCalls
        self.timestamp = timestamp
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id && lhs.content == rhs.content && lhs.imageURL == rhs.imageURL && lhs.toolCalls == rhs.toolCalls
    }
}

// MARK: - Service

@Observable
final class LocalLLMService {
    // MARK: - Model Registry

    private(set) var userMLXModels: [AIModel] = []
    private(set) var userGGUFModels: [AIModel] = []
    private(set) var ollamaModels: [AIModel] = []
    private(set) var isOllamaRunning = false

    var allModels: [AIModel] {
        [.appleIntelligence] + userMLXModels + userGGUFModels + ollamaModels
    }

    var availableModels: [AIModel] {
        allModels.filter { isAvailable($0) }
    }

    // MARK: - Download / Loading State (keyed by model ID string)

    private(set) var downloadProgress: [String: Double] = [:]
    private(set) var isDownloading: [String: Bool] = [:]
    private(set) var downloadedModels: Set<String> = []
    private(set) var downloadErrors: [String: String] = [:]
    private(set) var isLoadingModel: [String: Bool] = [:]

    private var fmSessions: [UUID: LanguageModelSession] = [:]
    private var downloadTasks: [String: Task<Void, Never>] = [:]
    private var mlxContainers: [String: ModelContainer] = [:]

    #if canImport(LocalLLMClient)
    // llama.cpp sessions (keyed by instanceID, like FM sessions)
    private var llamaSessions: [UUID: LLMSession] = [:]
    private var llamaTools: [any LLMTool] = []
    #endif

    // Tool call tracking (shared across providers)
    private(set) var lastResponseToolCalls: [ToolCallEntry] = []

    // Tool calling (MLX)
    private(set) var toolSchemas: [[String: any Sendable]] = []
    private var toolExecutors: [String: @Sendable (ToolCall) async throws -> String] = [:]
    private var toolsRegistered = false

    let modelsDirectory: URL

    /// The primary directory where downloaded models actually reside.
    var actualModelsDirectory: URL {
        let fm = FileManager.default
        // MLX models: ~/Library/Caches/models/
        if let cachesDir = fm.urls(for: .cachesDirectory, in: .userDomainMask).first {
            let hubCache = cachesDir.appendingPathComponent("models", isDirectory: true)
            if fm.fileExists(atPath: hubCache.path) {
                return hubCache
            }
        }
        // GGUF models: ~/.localllmclient/
        let llamaDir = fm.homeDirectoryForCurrentUser.appendingPathComponent(".localllmclient")
        if fm.fileExists(atPath: llamaDir.path) {
            return llamaDir
        }
        // Fallback
        return modelsDirectory
    }

    private static let userMLXModelsKey = "ThirdScreen_UserMLXModels"
    private static let userGGUFModelsKey = "ThirdScreen_UserGGUFModels"
    private static let mlxModelsSeededKey = "ThirdScreen_MLXModelsSeeded"
    private static let ggufModelsSeededKey = "ThirdScreen_GGUFModelsSeeded"

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        modelsDirectory = appSupport.appendingPathComponent("ThirdScreen/Models", isDirectory: true)
        try? FileManager.default.createDirectory(at: modelsDirectory, withIntermediateDirectories: true)
        loadUserMLXModels()
        loadUserGGUFModels()
        scanDownloadedModels()
    }

    // MARK: - Tool Registration

    func registerTools(timerService: TimerService, toastManager: ToastManager? = nil) {
        guard !toolsRegistered else { return }
        toolsRegistered = true

        let capturedTimerService = timerService
        let capturedToastManager = toastManager

        // --- set_timer tool ---
        struct SetTimerInput: Codable { let minutes: Int }
        struct SetTimerOutput: Codable { let message: String }

        let setTimerTool = Tool<SetTimerInput, SetTimerOutput>(
            name: "set_timer",
            description: "Set a countdown timer for the specified number of minutes. Only use when the user explicitly asks to set a timer or countdown.",
            parameters: [
                .required("minutes", type: .int, description: "Number of minutes for the timer (1 to 120)")
            ]
        ) { input in
            SetTimerOutput(message: "Timer set for \(input.minutes) minute(s)")
        }

        toolSchemas.append(setTimerTool.schema)

        toolExecutors["set_timer"] = { @Sendable call in
            guard let minutesValue = call.function.arguments["minutes"] else {
                return "Error: missing minutes parameter"
            }
            let minutes: Int
            switch minutesValue {
            case .int(let v): minutes = v
            case .double(let v): minutes = Int(v)
            case .string(let v): minutes = Int(v) ?? 5
            default: minutes = 5
            }
            let clamped = max(1, min(120, minutes))
            await MainActor.run {
                capturedTimerService.setTimer(minutes: clamped)
                capturedToastManager?.show(ToastItem(
                    icon: "timer",
                    iconColor: .orange,
                    title: "Timer Started",
                    subtitle: "\(clamped) minute\(clamped == 1 ? "" : "s")"
                ))
            }
            return "Timer set for \(clamped) minute\(clamped == 1 ? "" : "s") and started."
        }

        // --- get_current_time tool ---
        struct GetTimeInput: Codable {}
        struct GetTimeOutput: Codable { let time: String; let date: String; let timezone: String }

        let getTimeTool = Tool<GetTimeInput, GetTimeOutput>(
            name: "get_current_time",
            description: "Get the current date and time. Use when the user asks what time or date it is.",
            parameters: []
        ) { _ in
            let now = Date()
            let timeFmt = DateFormatter()
            timeFmt.dateFormat = "h:mm:ss a"
            let dateFmt = DateFormatter()
            dateFmt.dateFormat = "EEEE, MMMM d, yyyy"
            return GetTimeOutput(
                time: timeFmt.string(from: now),
                date: dateFmt.string(from: now),
                timezone: TimeZone.current.identifier
            )
        }

        toolSchemas.append(getTimeTool.schema)

        toolExecutors["get_current_time"] = { @Sendable _ in
            let now = Date()
            let timeFmt = DateFormatter()
            timeFmt.dateFormat = "h:mm:ss a"
            let dateFmt = DateFormatter()
            dateFmt.dateFormat = "EEEE, MMMM d, yyyy"
            let tz = TimeZone.current.identifier
            return "Current time: \(timeFmt.string(from: now)), Date: \(dateFmt.string(from: now)), Timezone: \(tz)"
        }

        #if canImport(LocalLLMClient)
        // llama.cpp tools (using LocalLLMClient's LLMTool protocol)
        let logAction: @Sendable (String, String) async -> Void = { @Sendable [weak self] name, result in
            await MainActor.run {
                self?.lastResponseToolCalls.append(ToolCallEntry(toolName: name, result: result))
            }
        }

        llamaTools = [
            SetTimerLlamaTool(timerAction: { @Sendable minutes in
                await MainActor.run {
                    capturedTimerService.setTimer(minutes: minutes)
                    capturedToastManager?.show(ToastItem(
                        icon: "timer",
                        iconColor: .orange,
                        title: "Timer Started",
                        subtitle: "\(minutes) minute\(minutes == 1 ? "" : "s")"
                    ))
                }
            }, logAction: logAction),
            GetCurrentTimeLlamaTool(logAction: logAction)
        ]
        #endif
    }

    /// Clear tool call log before a new response
    func clearToolCallLog() {
        lastResponseToolCalls = []
    }

    // MARK: - Persistence

    private func loadUserMLXModels() {
        if let data = UserDefaults.standard.data(forKey: Self.userMLXModelsKey),
           let models = try? JSONDecoder().decode([AIModel].self, from: data) {
            userMLXModels = models
        }

        // Seed default Qwen model on first launch
        if !UserDefaults.standard.bool(forKey: Self.mlxModelsSeededKey) {
            if !userMLXModels.contains(where: { $0.id == AIModel.defaultQwen25VL.id }) {
                userMLXModels.append(.defaultQwen25VL)
            }
            UserDefaults.standard.set(true, forKey: Self.mlxModelsSeededKey)
            persistUserMLXModels()
        }
    }

    private func persistUserMLXModels() {
        if let data = try? JSONEncoder().encode(userMLXModels) {
            UserDefaults.standard.set(data, forKey: Self.userMLXModelsKey)
        }
    }

    // MARK: - GGUF Model Persistence

    private func loadUserGGUFModels() {
        if let data = UserDefaults.standard.data(forKey: Self.userGGUFModelsKey),
           let models = try? JSONDecoder().decode([AIModel].self, from: data) {
            userGGUFModels = models
        }

        // Seed default GGUF model on first launch
        if !UserDefaults.standard.bool(forKey: Self.ggufModelsSeededKey) {
            if !userGGUFModels.contains(where: { $0.id == AIModel.defaultQwen25GGUF.id }) {
                userGGUFModels.append(.defaultQwen25GGUF)
            }
            UserDefaults.standard.set(true, forKey: Self.ggufModelsSeededKey)
            persistUserGGUFModels()
        }
    }

    private func persistUserGGUFModels() {
        if let data = try? JSONEncoder().encode(userGGUFModels) {
            UserDefaults.standard.set(data, forKey: Self.userGGUFModelsKey)
        }
    }

    // MARK: - GGUF Model Management

    func addGGUFModel(repoID: String, ggufFilename: String, displayName: String? = nil) {
        let trimmedRepo = repoID.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedFile = ggufFilename.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedRepo.isEmpty, !trimmedFile.isEmpty else { return }
        let modelID = "gguf:\(trimmedRepo)/\(trimmedFile)"
        guard !userGGUFModels.contains(where: { $0.id == modelID }) else { return }

        let name = displayName ?? trimmedFile.replacingOccurrences(of: ".gguf", with: "")
        let model = AIModel.llamaCppModel(
            repoID: trimmedRepo,
            ggufFilename: trimmedFile,
            displayName: name,
            subtitle: "GGUF model"
        )
        userGGUFModels.append(model)
        persistUserGGUFModels()
    }

    func removeGGUFModel(id: String) {
        cancelDownload(id: id)
        #if canImport(LocalLLMClient)
        llamaSessions.removeAll()
        #endif
        userGGUFModels.removeAll { $0.id == id }
        persistUserGGUFModels()
        downloadedModels.remove(id)
        downloadProgress.removeValue(forKey: id)
        downloadErrors.removeValue(forKey: id)
    }

    // MARK: - MLX Model Management

    func addMLXModel(repoID: String, displayName: String? = nil, isVLM: Bool = false) {
        let trimmed = repoID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let modelID = "mlx:\(trimmed)"
        guard !userMLXModels.contains(where: { $0.id == modelID }) else { return }

        let name = displayName ?? trimmed.components(separatedBy: "/").last ?? trimmed
        let model = AIModel.mlxModel(
            repoID: trimmed,
            displayName: name,
            subtitle: isVLM ? "Multimodal (text & images)" : "Text generation",
            isVLM: isVLM
        )
        userMLXModels.append(model)
        persistUserMLXModels()
    }

    func removeMLXModel(id: String) {
        cancelDownload(id: id)
        unloadMLXModel(id: id)
        userMLXModels.removeAll { $0.id == id }
        persistUserMLXModels()
        downloadedModels.remove(id)
        downloadProgress.removeValue(forKey: id)
        downloadErrors.removeValue(forKey: id)
        // Delete cached files managed by MLX Hub if they exist in our models directory
        if let model = allModels.first(where: { $0.id == id }), let repo = model.huggingFaceRepo {
            let dirName = repo.replacingOccurrences(of: "/", with: "_")
            let modelDir = modelsDirectory.appendingPathComponent(dirName, isDirectory: true)
            try? FileManager.default.removeItem(at: modelDir)
        }
    }

    // MARK: - Ollama Discovery

    func refreshOllamaModels() async {
        guard let url = URL(string: "http://localhost:11434/api/tags") else { return }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                await MainActor.run {
                    self.isOllamaRunning = false
                    self.ollamaModels = []
                }
                return
            }

            struct OllamaTagsResponse: Decodable {
                struct Model: Decodable {
                    let name: String
                    let size: Int64?
                }
                let models: [Model]?
            }

            let tagsResponse = try JSONDecoder().decode(OllamaTagsResponse.self, from: data)
            let models = (tagsResponse.models ?? []).map { m in
                let sizeStr: String? = m.size.map { formatBytes($0) }
                return AIModel.ollamaModel(name: m.name, size: sizeStr)
            }

            await MainActor.run {
                self.isOllamaRunning = true
                self.ollamaModels = models
            }
        } catch {
            await MainActor.run {
                self.isOllamaRunning = false
                self.ollamaModels = []
            }
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let gb = Double(bytes) / 1_073_741_824
        if gb >= 1 {
            return String(format: "%.1f GB", gb)
        }
        let mb = Double(bytes) / 1_048_576
        return String(format: "%.0f MB", mb)
    }

    // MARK: - Availability

    func isAvailable(_ model: AIModel) -> Bool {
        switch model.provider {
        case .appleFoundation:
            return true
        case .mlx, .llamaCpp:
            return downloadedModels.contains(model.id)
        case .ollama:
            return isOllamaRunning
        }
    }

    func model(forID id: String) -> AIModel? {
        allModels.first { $0.id == id }
    }

    /// Returns the on-disk storage size (in bytes) for a downloaded model, or nil if not found.
    func modelStorageBytes(_ model: AIModel) -> Int64? {
        guard let repo = model.huggingFaceRepo else { return nil }
        let fm = FileManager.default

        switch model.provider {
        case .mlx:
            if let cachesDir = fm.urls(for: .cachesDirectory, in: .userDomainMask).first {
                let modelDir = cachesDir.appendingPathComponent("models", isDirectory: true)
                    .appendingPathComponent(repo, isDirectory: true)
                if let size = Self.directorySize(at: modelDir), size > 0 { return size }
            }
            let dirName = repo.replacingOccurrences(of: "/", with: "_")
            let localDir = modelsDirectory.appendingPathComponent(dirName, isDirectory: true)
            return Self.directorySize(at: localDir)
        case .llamaCpp:
            guard let gguf = model.ggufFilename else { return nil }
            let file = fm.homeDirectoryForCurrentUser
                .appendingPathComponent(".localllmclient")
                .appendingPathComponent(repo)
                .appendingPathComponent(gguf)
            let attrs = try? fm.attributesOfItem(atPath: file.path)
            return attrs?[.size] as? Int64
        default:
            return nil
        }
    }

    private static func directorySize(at url: URL) -> Int64? {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey], options: [.skipsHiddenFiles]) else { return nil }
        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            if let size = (try? fileURL.resourceValues(forKeys: [.fileSizeKey]))?.fileSize {
                total += Int64(size)
            }
        }
        return total > 0 ? total : nil
    }

    // MARK: - Session Management

    func resetSession(for instanceID: UUID) {
        fmSessions.removeValue(forKey: instanceID)
        #if canImport(LocalLLMClient)
        llamaSessions.removeValue(forKey: instanceID)
        #endif
    }

    private func getOrCreateFMSession(for instanceID: UUID, systemPrompt: String) -> LanguageModelSession {
        if let existing = fmSessions[instanceID] {
            return existing
        }
        let session = LanguageModelSession(instructions: systemPrompt)
        fmSessions[instanceID] = session
        return session
    }

    // MARK: - MLX Model Loading

    private func getOrLoadMLXContainer(_ model: AIModel) async throws -> ModelContainer {
        if let existing = mlxContainers[model.id] {
            return existing
        }

        guard let repo = model.huggingFaceRepo else {
            throw AIServiceError.downloadFailed("No HuggingFace repo for model \(model.displayName)")
        }

        await MainActor.run { isLoadingModel[model.id] = true }

        let config = ModelConfiguration(id: repo)

        MLX.GPU.set(cacheLimit: 20 * 1024 * 1024)

        let container: ModelContainer
        if model.isVLM {
            container = try await VLMModelFactory.shared.loadContainer(configuration: config) { _ in }
        } else {
            container = try await LLMModelFactory.shared.loadContainer(configuration: config) { _ in }
        }

        mlxContainers[model.id] = container
        await MainActor.run { isLoadingModel[model.id] = false }
        return container
    }

    func unloadMLXModel(id: String) {
        mlxContainers.removeValue(forKey: id)
    }

    /// Unloads all loaded models except the one with the given ID to free memory.
    func unloadAllExcept(modelID: String) {
        // Unload all MLX containers except the selected model
        for key in mlxContainers.keys where key != modelID {
            mlxContainers.removeValue(forKey: key)
        }

        #if canImport(LocalLLMClient)
        // Clear llama.cpp sessions if switching away from a llama model
        if !(model(forID: modelID)?.provider == .llamaCpp) {
            llamaSessions.removeAll()
        }
        #endif

        // Clear Foundation Model sessions if switching away
        if !(model(forID: modelID)?.provider == .appleFoundation) {
            fmSessions.removeAll()
        }
    }

    // MARK: - Generation

    /// Streams a response. Yields accumulated text (not deltas).
    func streamResponse(
        to prompt: String,
        model: AIModel,
        instanceID: UUID,
        systemPrompt: String,
        imageURL: URL? = nil,
        messages: [ChatMessage] = []
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    switch model.provider {
                    case .appleFoundation:
                        try await streamFoundationModel(
                            prompt: prompt,
                            instanceID: instanceID,
                            systemPrompt: systemPrompt,
                            continuation: continuation
                        )
                    case .mlx:
                        try await streamMLXModel(
                            prompt: prompt,
                            model: model,
                            systemPrompt: systemPrompt,
                            imageURL: imageURL,
                            messages: messages,
                            continuation: continuation
                        )
                    case .ollama:
                        try await streamOllamaModel(
                            prompt: prompt,
                            model: model,
                            systemPrompt: systemPrompt,
                            imageURL: imageURL,
                            messages: messages,
                            continuation: continuation
                        )
                    case .llamaCpp:
                        #if canImport(LocalLLMClient)
                        try await streamLlamaCppModel(
                            prompt: prompt,
                            model: model,
                            instanceID: instanceID,
                            systemPrompt: systemPrompt,
                            messages: messages,
                            continuation: continuation
                        )
                        #else
                        throw AIServiceError.generationFailed("llama.cpp support requires the LocalLLMClient package")
                        #endif
                    }
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func streamFoundationModel(
        prompt: String,
        instanceID: UUID,
        systemPrompt: String,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        let session = getOrCreateFMSession(for: instanceID, systemPrompt: systemPrompt)
        let stream = session.streamResponse(to: prompt)
        for try await partial in stream {
            continuation.yield(partial.content)
        }
        continuation.finish()
    }

    private func streamMLXModel(
        prompt: String,
        model: AIModel,
        systemPrompt: String,
        imageURL: URL?,
        messages: [ChatMessage],
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        let container = try await getOrLoadMLXContainer(model)
        let parameters = GenerateParameters(temperature: 0.7)

        // Build chat messages for multi-turn + tool calling
        var chatMessages: [Chat.Message] = [.system(systemPrompt)]
        for msg in messages {
            switch msg.role {
            case .user:
                if let imgURL = msg.imageURL, model.isVLM {
                    chatMessages.append(.user(msg.content, images: [.url(imgURL)]))
                } else {
                    chatMessages.append(.user(msg.content))
                }
            case .assistant:
                chatMessages.append(.assistant(msg.content))
            }
        }
        if let imageURL, model.isVLM {
            chatMessages.append(.user(prompt, images: [.url(imageURL)]))
        } else {
            chatMessages.append(.user(prompt))
        }

        let schemas: [[String: any Sendable]]? = toolSchemas.isEmpty ? nil : toolSchemas
        let executors = toolExecutors

        var accumulated = ""
        var currentChat = chatMessages
        var toolRoundsRemaining = 3

        while toolRoundsRemaining > 0 {
            toolRoundsRemaining -= 1
            var roundToolCalls: [ToolCall] = []

            let userInput = UserInput(chat: currentChat, tools: schemas)

            try await container.perform { [userInput] context in
                let lmInput = try await context.processor.prepare(input: userInput)
                let stream: AsyncStream<Generation> = try MLXLMCommon.generate(
                    input: lmInput,
                    parameters: parameters,
                    context: context
                )

                for await generation in stream {
                    switch generation {
                    case .chunk(let text):
                        accumulated += text
                        continuation.yield(accumulated)
                    case .toolCall(let call):
                        roundToolCalls.append(call)
                    case .info:
                        break
                    }
                }
            }

            if roundToolCalls.isEmpty { break }

            // Add assistant's partial response to chat history
            if !accumulated.isEmpty {
                currentChat.append(.assistant(accumulated))
            }

            // Execute tools and feed results back
            for call in roundToolCalls {
                if let executor = executors[call.function.name] {
                    do {
                        let result = try await executor(call)
                        currentChat.append(.tool(result))
                        await MainActor.run {
                            self.lastResponseToolCalls.append(ToolCallEntry(toolName: call.function.name, result: result))
                        }
                    } catch {
                        currentChat.append(.tool("Error: \(error.localizedDescription)"))
                    }
                }
            }

            // Reset for next round
            accumulated = ""
        }

        continuation.finish()
    }

    private func streamOllamaModel(
        prompt: String,
        model: AIModel,
        systemPrompt: String,
        imageURL: URL?,
        messages: [ChatMessage],
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        guard isOllamaRunning, let modelName = model.ollamaModelName else {
            throw AIServiceError.ollamaNotRunning
        }

        guard let url = URL(string: "http://localhost:11434/api/chat") else {
            throw AIServiceError.generationFailed("Invalid Ollama URL")
        }

        // Build message history
        var ollamaMessages: [[String: Any]] = [
            ["role": "system", "content": systemPrompt]
        ]

        for msg in messages {
            var entry: [String: Any] = [
                "role": msg.role.rawValue,
                "content": msg.content
            ]
            // Base64-encode images for Ollama
            if let imgURL = msg.imageURL,
               let imgData = try? Data(contentsOf: imgURL) {
                entry["images"] = [imgData.base64EncodedString()]
            }
            ollamaMessages.append(entry)
        }

        // Add the current user prompt
        var currentMessage: [String: Any] = ["role": "user", "content": prompt]
        if let imageURL, let imgData = try? Data(contentsOf: imageURL) {
            currentMessage["images"] = [imgData.base64EncodedString()]
        }
        ollamaMessages.append(currentMessage)

        let body: [String: Any] = [
            "model": modelName,
            "messages": ollamaMessages,
            "stream": true
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIServiceError.generationFailed("Ollama returned an error")
        }

        var accumulated = ""
        for try await line in bytes.lines {
            guard !line.isEmpty else { continue }
            guard let lineData = line.data(using: .utf8) else { continue }

            struct OllamaChatChunk: Decodable {
                struct Message: Decodable {
                    let content: String?
                }
                let message: Message?
                let done: Bool?
            }

            if let chunk = try? JSONDecoder().decode(OllamaChatChunk.self, from: lineData),
               let content = chunk.message?.content, !content.isEmpty {
                accumulated += content
                continuation.yield(accumulated)
            }
        }
        continuation.finish()
    }

    #if canImport(LocalLLMClient)
    // MARK: - llama.cpp (LocalLLMClient)

    private func getOrCreateLlamaSession(
        for instanceID: UUID,
        model: AIModel,
        systemPrompt: String
    ) -> LLMSession {
        if let existing = llamaSessions[instanceID] {
            return existing
        }

        guard let repo = model.huggingFaceRepo, let gguf = model.ggufFilename else {
            fatalError("llamaCpp model missing repo or gguf filename")
        }

        let downloadModel = LLMSession.DownloadModel.llama(
            id: repo,
            model: gguf,
            parameter: .init(
                context: 4096,
                temperature: 0.7,
                topK: 40,
                topP: 0.9
            )
        )

        let session = LLMSession(
            model: downloadModel,
            messages: [.system(systemPrompt)],
            tools: llamaTools
        )
        llamaSessions[instanceID] = session
        return session
    }

    private func streamLlamaCppModel(
        prompt: String,
        model: AIModel,
        instanceID: UUID,
        systemPrompt: String,
        messages: [ChatMessage],
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        let session = getOrCreateLlamaSession(for: instanceID, model: model, systemPrompt: systemPrompt)

        // If this is a fresh session (only system message), replay history
        if session.messages.count <= 1, !messages.isEmpty {
            for msg in messages {
                switch msg.role {
                case .user:
                    session.messages.append(.user(msg.content))
                case .assistant:
                    session.messages.append(.assistant(msg.content))
                }
            }
        }

        await MainActor.run { isLoadingModel[model.id] = true }

        var accumulated = ""
        let stream = session.streamResponse(to: prompt)
        for try await chunk in stream {
            accumulated += chunk
            continuation.yield(accumulated)
        }

        await MainActor.run { isLoadingModel[model.id] = false }
        continuation.finish()
    }
    #endif

    // MARK: - Model Downloads

    func downloadModel(_ model: AIModel) {
        guard model.requiresDownload, !isAvailable(model), isDownloading[model.id] != true else { return }

        isDownloading[model.id] = true
        downloadProgress[model.id] = 0
        downloadErrors[model.id] = nil

        let task = Task { [weak self] in
            guard let self else { return }
            do {
                switch model.provider {
                case .mlx:
                    try await self.performMLXDownload(model)
                case .llamaCpp:
                    #if canImport(LocalLLMClient)
                    try await self.performGGUFDownload(model)
                    #endif
                default:
                    break
                }
                await MainActor.run {
                    self.downloadedModels.insert(model.id)
                    self.isDownloading[model.id] = false
                    self.downloadProgress[model.id] = 1.0
                }
            } catch is CancellationError {
                await MainActor.run {
                    self.isDownloading[model.id] = false
                    self.downloadProgress[model.id] = nil
                }
            } catch {
                await MainActor.run {
                    self.isDownloading[model.id] = false
                    self.downloadErrors[model.id] = error.localizedDescription
                }
            }
        }
        downloadTasks[model.id] = task
    }

    func cancelDownload(id: String) {
        downloadTasks[id]?.cancel()
        downloadTasks.removeValue(forKey: id)
        isDownloading[id] = false
        downloadProgress[id] = nil
    }

    func deleteModel(_ model: AIModel) {
        guard model.requiresDownload else { return }
        switch model.provider {
        case .mlx:
            unloadMLXModel(id: model.id)
        case .llamaCpp:
            #if canImport(LocalLLMClient)
            llamaSessions.removeAll()
            #endif
        default:
            break
        }
        downloadedModels.remove(model.id)
        downloadProgress.removeValue(forKey: model.id)

        guard let repo = model.huggingFaceRepo else { return }
        let fm = FileManager.default

        // Remove from Hub cache (~/Library/Caches/models/{org}/{model}/)
        if let cachesDir = fm.urls(for: .cachesDirectory, in: .userDomainMask).first {
            let hubModelDir = cachesDir.appendingPathComponent("models", isDirectory: true)
                .appendingPathComponent(repo, isDirectory: true)
            try? fm.removeItem(at: hubModelDir)
        }

        // Also remove from our own models directory
        let dirName = repo.replacingOccurrences(of: "/", with: "_")
        let localDir = modelsDirectory.appendingPathComponent(dirName, isDirectory: true)
        try? fm.removeItem(at: localDir)
    }

    // MARK: - Private

    private func scanDownloadedModels() {
        let fm = FileManager.default

        // MLX Swift Hub caches models to ~/Library/Caches/models/{org}/{model}/
        // Inside the sandbox this resolves to the container's Caches directory.
        let cachesDir = fm.urls(for: .cachesDirectory, in: .userDomainMask).first
        let hubCacheBase = cachesDir?.appendingPathComponent("models", isDirectory: true)

        for model in userMLXModels {
            guard let repo = model.huggingFaceRepo else { continue }

            // Primary: ~/Library/Caches/models/{org}/{model}/config.json
            if let hubCacheBase {
                let modelDir = hubCacheBase.appendingPathComponent(repo, isDirectory: true)
                let configFile = modelDir.appendingPathComponent("config.json")
                if fm.fileExists(atPath: configFile.path) {
                    downloadedModels.insert(model.id)
                    continue
                }
            }

            // Fallback: our own models directory
            let dirName = repo.replacingOccurrences(of: "/", with: "_")
            let localDir = modelsDirectory.appendingPathComponent(dirName, isDirectory: true)
            let configFile = localDir.appendingPathComponent("config.json")
            if fm.fileExists(atPath: configFile.path) {
                downloadedModels.insert(model.id)
            }
        }

        // Scan GGUF models — LocalLLMClient downloads to ~/.localllmclient/
        let llamaCacheDir = fm.homeDirectoryForCurrentUser
            .appendingPathComponent(".localllmclient")
        for model in userGGUFModels {
            guard let repo = model.huggingFaceRepo, let gguf = model.ggufFilename else { continue }
            let modelFile = llamaCacheDir
                .appendingPathComponent(repo)
                .appendingPathComponent(gguf)
            if fm.fileExists(atPath: modelFile.path) {
                downloadedModels.insert(model.id)
            }
        }
    }

    private func performMLXDownload(_ model: AIModel) async throws {
        guard let repo = model.huggingFaceRepo else {
            throw AIServiceError.downloadFailed("No repository configured for \(model.displayName)")
        }

        // Use ModelConfiguration(id:) which triggers HuggingFace Hub auto-download
        let config = ModelConfiguration(id: repo)

        await MainActor.run {
            self.downloadProgress[model.id] = 0.1
        }

        MLX.GPU.set(cacheLimit: 20 * 1024 * 1024)

        // Loading the model triggers the download
        let container: ModelContainer
        if model.isVLM {
            container = try await VLMModelFactory.shared.loadContainer(configuration: config) { progress in
                Task { @MainActor in
                    self.downloadProgress[model.id] = progress.fractionCompleted * 0.9 + 0.1
                }
            }
        } else {
            container = try await LLMModelFactory.shared.loadContainer(configuration: config) { progress in
                Task { @MainActor in
                    self.downloadProgress[model.id] = progress.fractionCompleted * 0.9 + 0.1
                }
            }
        }

        // Cache the loaded container so we don't need to load again
        mlxContainers[model.id] = container
    }

    #if canImport(LocalLLMClient)
    private func performGGUFDownload(_ model: AIModel) async throws {
        guard let repo = model.huggingFaceRepo, let gguf = model.ggufFilename else {
            throw AIServiceError.downloadFailed("No GGUF file configured for \(model.displayName)")
        }

        let downloadModel = LLMSession.DownloadModel.llama(
            id: repo,
            model: gguf,
            parameter: .default
        )

        try await downloadModel.downloadModel { [weak self] progress in
            guard let self else { return }
            await MainActor.run {
                self.downloadProgress[model.id] = progress
            }
        }
    }
    #endif
}
