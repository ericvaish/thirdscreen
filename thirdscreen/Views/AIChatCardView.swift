import SwiftUI
import UniformTypeIdentifiers

struct AIChatCardView: View {
    @Bindable var llmService: LocalLLMService
    @Binding var config: AIChatCardConfig
    let instanceID: UUID

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isGenerating = false
    @State private var streamingText = ""
    @State private var errorMessage: String?
    @State private var attachedImageURL: URL?

    private var selectedModel: AIModel {
        llmService.model(forID: config.selectedModelID) ?? .appleIntelligence
    }

    private var supportsImages: Bool {
        selectedModel.isVLM
    }

    var body: some View {
        VStack(spacing: 0) {
            chatHeader
            Divider()
            messageList
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
            }
            Divider()
            inputBar
        }
        .onChange(of: config.selectedModelID) { _, newModelID in
            llmService.unloadAllExcept(modelID: newModelID)
        }
    }

    // MARK: - Header

    private var chatHeader: some View {
        HStack(spacing: 8) {
            Picker("Model", selection: $config.selectedModelID) {
                ForEach(llmService.availableModels) { model in
                    Label(model.displayName, systemImage: model.iconName)
                        .tag(model.id)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .fixedSize()

            if llmService.isLoadingModel[selectedModel.id] == true {
                ProgressView()
                    .scaleEffect(0.6)
                    .help("Loading model…")
            }

            Spacer()

            if !messages.isEmpty {
                Button {
                    messages.removeAll()
                    streamingText = ""
                    errorMessage = nil
                    attachedImageURL = nil
                    llmService.resetSession(for: instanceID)
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .help("Clear conversation")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    // MARK: - Messages

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if messages.isEmpty && !isGenerating {
                        emptyState
                    }

                    ForEach(messages) { message in
                        MessageBubble(message: message)
                    }

                    if isGenerating {
                        MessageBubble(
                            message: ChatMessage(
                                role: .assistant,
                                content: streamingText.isEmpty ? "Thinking..." : streamingText
                            )
                        )
                        .id("streaming")
                    }
                }
                .padding(12)
            }
            .onChange(of: streamingText) { _, _ in
                withAnimation(.easeOut(duration: 0.1)) {
                    proxy.scrollTo("streaming", anchor: .bottom)
                }
            }
            .onChange(of: messages.count) { _, _ in
                if let last = messages.last {
                    withAnimation(.easeOut(duration: 0.15)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: selectedModel.iconName)
                .font(.largeTitle)
                .foregroundStyle(.tertiary)
            Text("Chat with \(selectedModel.displayName)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if supportsImages {
                Text("Supports image understanding")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 40)
    }

    // MARK: - Input

    private var inputBar: some View {
        VStack(spacing: 0) {
            if let imageURL = attachedImageURL {
                HStack(spacing: 6) {
                    if let nsImage = NSImage(contentsOf: imageURL) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 40, height: 40)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    Text(imageURL.lastPathComponent)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                    Button {
                        attachedImageURL = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }

            HStack(spacing: 8) {
                if supportsImages {
                    Button {
                        pickImage()
                    } label: {
                        Image(systemName: "photo")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.borderless)
                    .help("Attach image")
                }

                TextField("Message...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .onSubmit {
                        if !NSEvent.modifierFlags.contains(.shift) {
                            sendMessage()
                        }
                    }

                Button {
                    if isGenerating {
                        // Could add cancellation here
                    } else {
                        sendMessage()
                    }
                } label: {
                    Image(systemName: isGenerating ? "stop.circle.fill" : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(canSend ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.borderless)
                .disabled(!canSend && !isGenerating)
            }
            .padding(12)
        }
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isGenerating
    }

    // MARK: - Actions

    private func pickImage() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        if panel.runModal() == .OK, let url = panel.url {
            attachedImageURL = url
        }
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isGenerating else { return }

        let imageURL = attachedImageURL
        let userMessage = ChatMessage(role: .user, content: text, imageURL: imageURL)
        messages.append(userMessage)
        inputText = ""
        attachedImageURL = nil
        isGenerating = true
        streamingText = ""
        errorMessage = nil

        let currentModel = selectedModel
        let currentMessages = messages

        Task {
            llmService.clearToolCallLog()
            do {
                let stream = llmService.streamResponse(
                    to: text,
                    model: currentModel,
                    instanceID: instanceID,
                    systemPrompt: config.systemPrompt,
                    imageURL: imageURL,
                    messages: currentMessages.dropLast().map { $0 } // Pass history (excluding the message we just added, which is the current prompt)
                )
                var accumulated = ""
                for try await text in stream {
                    accumulated = text
                    streamingText = accumulated
                }
                let response = ChatMessage(role: .assistant, content: accumulated, toolCalls: llmService.lastResponseToolCalls)
                messages.append(response)
            } catch {
                errorMessage = error.localizedDescription
            }
            isGenerating = false
            streamingText = ""
        }
    }
}

// MARK: - Message Bubble

private func markdownAttributedString(_ string: String) -> AttributedString {
    (try? AttributedString(markdown: string, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(string)
}

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 40)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                if let imageURL = message.imageURL, let nsImage = NSImage(contentsOf: imageURL) {
                    Image(nsImage: nsImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 200, maxHeight: 150)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                // Tool call pills
                if !message.toolCalls.isEmpty {
                    ToolCallChain(toolCalls: message.toolCalls)
                }

                Text(markdownAttributedString(message.content))
                    .textSelection(.enabled)
                    .font(.body)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        message.role == .user
                            ? Color.accentColor.opacity(0.12)
                            : Color.secondary.opacity(0.08),
                        in: RoundedRectangle(cornerRadius: 14)
                    )
            }

            if message.role == .assistant {
                Spacer(minLength: 40)
            }
        }
    }
}

// MARK: - Tool Call Chain

private struct ToolCallChain: View {
    let toolCalls: [ToolCallEntry]
    @State private var expandedID: UUID?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(Array(toolCalls.enumerated()), id: \.element.id) { index, entry in
                HStack(spacing: 4) {
                    if index > 0 {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 8))
                            .foregroundStyle(.tertiary)
                    }
                    toolPill(entry)
                }
            }
        }
    }

    private func toolPill(_ entry: ToolCallEntry) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                expandedID = expandedID == entry.id ? nil : entry.id
            }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: iconForTool(entry.toolName))
                        .font(.system(size: 9))
                    Text(displayNameForTool(entry.toolName))
                        .font(.caption2)
                    Image(systemName: expandedID == entry.id ? "chevron.up" : "chevron.down")
                        .font(.system(size: 7))
                }

                if expandedID == entry.id {
                    Text(entry.result)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.accentColor.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func iconForTool(_ name: String) -> String {
        switch name {
        case "set_timer": return "timer"
        case "get_current_time": return "clock"
        default: return "wrench"
        }
    }

    private func displayNameForTool(_ name: String) -> String {
        switch name {
        case "set_timer": return "Set Timer"
        case "get_current_time": return "Get Time"
        default: return name.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}
