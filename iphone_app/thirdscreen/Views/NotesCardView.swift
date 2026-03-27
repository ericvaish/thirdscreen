import SwiftUI

enum NotesTab: String, CaseIterable {
    case notes
    case links

    var label: String {
        switch self {
        case .notes: return "Notes"
        case .links: return "Links"
        }
    }

    var iconName: String {
        switch self {
        case .notes: return "note.text"
        case .links: return "link"
        }
    }
}

struct NotesCardView: View {
    @Bindable var noteStore: NoteStore
    @State private var selectedNoteID: UUID?
    @State private var selectedLinkID: UUID?
    @State private var searchQuery = ""
    @State private var activeTab: NotesTab = .notes
    @State private var showAddLinkSheet = false

    var body: some View {
        HStack(spacing: 0) {
            sidebar
                .frame(width: 180)
            Divider()
            detailPanel
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: selectedNoteID) { _, newValue in
            if newValue != nil { selectedLinkID = nil }
        }
        .onChange(of: selectedLinkID) { _, newValue in
            if newValue != nil { selectedNoteID = nil }
        }
        .sheet(isPresented: $showAddLinkSheet) {
            AddLinkSheet(noteStore: noteStore) { link in
                selectedLinkID = link.id
                selectedNoteID = nil
                activeTab = .links
                showAddLinkSheet = false
            } onCancel: {
                showAddLinkSheet = false
            }
        }
    }

    // MARK: - Sidebar

    private var sidebar: some View {
        VStack(spacing: 0) {
            // Tab picker
            HStack(spacing: 0) {
                ForEach(NotesTab.allCases, id: \.self) { tab in
                    Button {
                        activeTab = tab
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: tab.iconName)
                                .appScaledSystemFont(size: 10)
                            Text(tab.label)
                                .appScaledSystemFont(size: 11, weight: .medium)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .frame(maxWidth: .infinity)
                        .background(activeTab == tab ? Color.accentColor.opacity(0.15) : Color.clear, in: RoundedRectangle(cornerRadius: 6))
                        .foregroundStyle(activeTab == tab ? .primary : .secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 4)

            // Search + add
            HStack(spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                        .appScaledSystemFont(size: 11)
                    TextField("Search…", text: $searchQuery)
                        .textFieldStyle(.plain)
                        .appScaledSystemFont(size: 12)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 7))

                if activeTab == .notes {
                    Button {
                        createNote()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("New note")
                } else {
                    Button {
                        showAddLinkSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("New link")
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)

            Divider()

            if activeTab == .notes {
                List(selection: $selectedNoteID) {
                    noteListSection()
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
            } else {
                List(selection: $selectedLinkID) {
                    linkListSection()
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - Note Sidebar Section

    @ViewBuilder
    private func noteListSection() -> some View {
        let notes = noteStore.sortedNotes(searchQuery: searchQuery)
        if notes.isEmpty {
            Text("No notes")
                .appScaledSystemFont(size: 11)
                .foregroundStyle(.tertiary)
        } else {
            ForEach(notes) { note in
                noteRowContent(note)
                    .tag(note.id)
            }
        }
    }

    private func noteRowContent(_ note: NoteItem) -> some View {
        HStack(spacing: 6) {
            if note.isPinned {
                Image(systemName: "pin.fill")
                    .appScaledSystemFont(size: 9)
                    .foregroundStyle(.orange)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(note.titlePreview)
                    .appScaledSystemFont(size: 12, weight: .medium)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(formattedDate(note.modifiedAt))
                        .appScaledSystemFont(size: 10)
                        .foregroundStyle(.tertiary)
                    if note.checklistItemCount > 0 {
                        Text("\(note.checkedItemCount)/\(note.checklistItemCount)")
                            .appScaledSystemFont(size: 10)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            Spacer()
        }
        .contextMenu {
            Button(note.isPinned ? "Unpin" : "Pin") {
                noteStore.togglePin(note)
            }
            Divider()
            Button("Delete", role: .destructive) {
                if selectedNoteID == note.id {
                    selectedNoteID = nil
                }
                noteStore.delete(note)
            }
        }
    }

    // MARK: - Link Sidebar Section

    @ViewBuilder
    private func linkListSection() -> some View {
        let links = noteStore.sortedLinks(searchQuery: searchQuery)
        if links.isEmpty {
            Text("No links")
                .appScaledSystemFont(size: 11)
                .foregroundStyle(.tertiary)
        } else {
            ForEach(links) { link in
                linkRowContent(link)
                    .tag(link.id)
            }
        }
    }

    private func linkRowContent(_ link: LinkItem) -> some View {
        HStack(spacing: 6) {
            if link.isPinned {
                Image(systemName: "pin.fill")
                    .appScaledSystemFont(size: 9)
                    .foregroundStyle(.orange)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(link.displayTitle)
                    .appScaledSystemFont(size: 12, weight: .medium)
                    .lineLimit(1)
                Text(link.hostname)
                    .appScaledSystemFont(size: 10)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .contextMenu {
            Button("Open in Browser") {
                if let url = URL(string: link.url) {
                    NSWorkspace.shared.open(url)
                }
            }
            Button("Copy URL") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(link.url, forType: .string)
            }
            Divider()
            Button(link.isPinned ? "Unpin" : "Pin") {
                noteStore.toggleLinkPin(link)
            }
            Divider()
            Button("Delete", role: .destructive) {
                if selectedLinkID == link.id {
                    selectedLinkID = nil
                }
                noteStore.deleteLink(link)
            }
        }
    }

    // MARK: - Detail Panel

    private var detailPanel: some View {
        Group {
            if activeTab == .notes {
                if let noteID = selectedNoteID, let note = noteStore.notes.first(where: { $0.id == noteID }) {
                    NoteEditorView(note: note, noteStore: noteStore)
                } else {
                    notesEmptyState
                }
            } else {
                if let linkID = selectedLinkID, let link = noteStore.links.first(where: { $0.id == linkID }) {
                    LinkDetailView(link: link, noteStore: noteStore)
                } else {
                    linksEmptyState
                }
            }
        }
    }

    private var notesEmptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "note.text")
                .appScaledSystemFont(size: 36)
                .foregroundStyle(.quaternary)
            Text("Select or create a note")
                .foregroundStyle(.secondary)
                .appScaledSystemFont(size: 13)
            Button {
                createNote()
            } label: {
                Label("New Note", systemImage: "plus")
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var linksEmptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "link.badge.plus")
                .appScaledSystemFont(size: 36)
                .foregroundStyle(.quaternary)
            Text("Save links to come back to later")
                .foregroundStyle(.secondary)
                .appScaledSystemFont(size: 13)
            Button {
                showAddLinkSheet = true
            } label: {
                Label("New Link", systemImage: "plus")
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func createNote() {
        let note = noteStore.add()
        selectedNoteID = note.id
        selectedLinkID = nil
        activeTab = .notes
    }

    private func formattedDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.dateFormat = "h:mm a"
            return formatter.string(from: date)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }
}

// MARK: - Add Link Sheet

struct AddLinkSheet: View {
    @Bindable var noteStore: NoteStore
    var onAdded: (LinkItem) -> Void
    var onCancel: () -> Void

    @State private var urlText = ""
    @State private var titleText = ""
    @FocusState private var urlFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add Link")
                .font(.headline)

            TextField("Paste URL here…", text: $urlText)
                .textFieldStyle(.roundedBorder)
                .focused($urlFieldFocused)

            TextField("Title (optional)", text: $titleText)
                .textFieldStyle(.roundedBorder)

            HStack {
                Spacer()
                Button("Cancel") {
                    onCancel()
                }
                .keyboardShortcut(.cancelAction)
                Button("Save") {
                    let link = noteStore.addLink(url: urlText, title: titleText)
                    onAdded(link)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(urlText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 360)
        .onAppear {
            urlFieldFocused = true
            // Auto-paste from clipboard if it looks like a URL
            if let clip = NSPasteboard.general.string(forType: .string),
               LinkItem.looksLikeURL(clip) {
                urlText = clip
            }
        }
    }
}

// MARK: - Link Detail View

struct LinkDetailView: View {
    let link: LinkItem
    @Bindable var noteStore: NoteStore
    @State private var editingTitle = false
    @State private var titleDraft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 6) {
                Spacer()
                Text(formattedTimestamp(link.createdAt))
                    .appScaledSystemFont(size: 10)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()

            VStack(alignment: .leading, spacing: 16) {
                // Title
                VStack(alignment: .leading, spacing: 4) {
                    Text("Title")
                        .appScaledSystemFont(size: 10, weight: .semibold)
                        .foregroundStyle(.secondary)
                    if editingTitle {
                        HStack(spacing: 6) {
                            TextField("Link title", text: $titleDraft)
                                .textFieldStyle(.roundedBorder)
                                .appScaledSystemFont(size: 13)
                                .onSubmit {
                                    saveTitle()
                                }
                            Button("Save") {
                                saveTitle()
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    } else {
                        HStack(spacing: 6) {
                            Text(link.title.isEmpty ? link.displayTitle : link.title)
                                .appScaledSystemFont(size: 14, weight: .medium)
                                .lineLimit(2)
                            Button {
                                titleDraft = link.title
                                editingTitle = true
                            } label: {
                                Image(systemName: "pencil")
                                    .appScaledSystemFont(size: 11)
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // URL
                VStack(alignment: .leading, spacing: 4) {
                    Text("URL")
                        .appScaledSystemFont(size: 10, weight: .semibold)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 8) {
                        Image(systemName: "link")
                            .appScaledSystemFont(size: 12)
                            .foregroundStyle(.blue)

                        Text(link.url)
                            .appScaledSystemFont(size: 13)
                            .foregroundStyle(.blue)
                            .lineLimit(3)
                            .onTapGesture {
                                if let url = URL(string: link.url) {
                                    NSWorkspace.shared.open(url)
                                }
                            }
                            .onHover { hovering in
                                if hovering {
                                    NSCursor.pointingHand.push()
                                } else {
                                    NSCursor.pop()
                                }
                            }
                    }
                }

                // Actions
                HStack(spacing: 10) {
                    Button {
                        if let url = URL(string: link.url) {
                            NSWorkspace.shared.open(url)
                        }
                    } label: {
                        Label("Open in Browser", systemImage: "safari")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(link.url, forType: .string)
                    } label: {
                        Label("Copy URL", systemImage: "doc.on.doc")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                Spacer()
            }
            .padding(16)
        }
        .onChange(of: link.id) { _, _ in
            editingTitle = false
        }
    }

    private func saveTitle() {
        var updated = link
        updated.title = titleDraft
        noteStore.updateLink(updated)
        editingTitle = false
    }

    private func formattedTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Note Editor

struct NoteEditorView: View {
    let note: NoteItem
    @Bindable var noteStore: NoteStore
    @State private var editedContent: String = ""
    @State private var hasAppeared = false
    @State private var showLinkSuggestion = false
    @State private var detectedURL = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header bar
            HStack(spacing: 6) {
                Spacer()
                Text("Edited \(formattedTimestamp(note.modifiedAt))")
                    .appScaledSystemFont(size: 10)
                    .foregroundStyle(.tertiary)
                Button {
                    insertChecklistItem()
                } label: {
                    Image(systemName: "checklist")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Insert checklist item")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()

            // Checklist summary (clickable toggles above the editor)
            let checklistLines = indexedChecklistLines()
            if !checklistLines.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(checklistLines, id: \.index) { item in
                        checklistRow(item: item)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 6)
                .padding(.bottom, 2)

                Divider()
                    .padding(.horizontal, 12)
            }

            // Text editor for full content
            NativeTextEditor(text: $editedContent)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Link suggestion banner
            if showLinkSuggestion {
                linkSuggestionBanner
            }
        }
        .onAppear {
            editedContent = note.content
            hasAppeared = true
        }
        .onChange(of: note.id) { _, _ in
            editedContent = note.content
            showLinkSuggestion = false
        }
        .onChange(of: note.content) { _, newValue in
            if editedContent != newValue {
                editedContent = newValue
            }
        }
        .onChange(of: editedContent) { _, newValue in
            guard hasAppeared, newValue != note.content else { return }
            var updated = note
            updated.content = newValue
            noteStore.update(updated)
            checkForURLContent(newValue)
        }
    }

    // MARK: - Link Suggestion

    private var linkSuggestionBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "link.badge.plus")
                .foregroundStyle(.blue)
                .appScaledSystemFont(size: 12)
            Text("Save as a link instead?")
                .appScaledSystemFont(size: 12)
                .foregroundStyle(.secondary)
            Spacer()
            Button("Save as Link") {
                noteStore.addLink(url: detectedURL)
                // Remove the URL from the note content
                let cleaned = editedContent
                    .replacingOccurrences(of: detectedURL, with: "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                editedContent = cleaned
                showLinkSuggestion = false
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Button {
                showLinkSuggestion = false
            } label: {
                Image(systemName: "xmark")
                    .appScaledSystemFont(size: 10)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.blue.opacity(0.06))
    }

    private func checkForURLContent(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lines = trimmed.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        guard let lastLine = lines.last else {
            showLinkSuggestion = false
            return
        }
        let lastLineTrimmed = lastLine.trimmingCharacters(in: .whitespacesAndNewlines)
        if LinkItem.looksLikeURL(lastLineTrimmed) && !lastLineTrimmed.hasPrefix("- [") {
            detectedURL = lastLineTrimmed
            showLinkSuggestion = true
        } else {
            showLinkSuggestion = false
        }
    }

    // MARK: - Checklist

    private struct ChecklistLine {
        let index: Int
        let text: String
        let isChecked: Bool
    }

    private func indexedChecklistLines() -> [ChecklistLine] {
        editedContent.components(separatedBy: "\n").enumerated().compactMap { index, line in
            if line.hasPrefix("- [x] ") {
                return ChecklistLine(index: index, text: String(line.dropFirst(6)), isChecked: true)
            } else if line.hasPrefix("- [ ] ") {
                return ChecklistLine(index: index, text: String(line.dropFirst(6)), isChecked: false)
            }
            return nil
        }
    }

    private func checklistRow(item: ChecklistLine) -> some View {
        HStack(spacing: 6) {
            Button {
                toggleChecklistLine(at: item.index)
            } label: {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.isChecked ? .green : .secondary)
            }
            .buttonStyle(.plain)

            Text(item.text)
                .appScaledSystemFont(size: 13)
                .strikethrough(item.isChecked)
                .foregroundStyle(item.isChecked ? .secondary : .primary)
                .lineLimit(1)
        }
        .padding(.vertical, 2)
    }

    private func toggleChecklistLine(at lineIndex: Int) {
        var lines = editedContent.components(separatedBy: "\n")
        guard lineIndex >= 0, lineIndex < lines.count else { return }
        if lines[lineIndex].hasPrefix("- [ ] ") {
            lines[lineIndex] = "- [x] " + lines[lineIndex].dropFirst(6)
        } else if lines[lineIndex].hasPrefix("- [x] ") {
            lines[lineIndex] = "- [ ] " + lines[lineIndex].dropFirst(6)
        }
        editedContent = lines.joined(separator: "\n")
    }

    private func insertChecklistItem() {
        if editedContent.isEmpty || editedContent.hasSuffix("\n") {
            editedContent += "- [ ] "
        } else {
            editedContent += "\n- [ ] "
        }
    }

    private func formattedTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Native NSTextView Wrapper

struct NativeTextEditor: NSViewRepresentable {
    @Binding var text: String

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        let textView = scrollView.documentView as! NSTextView
        textView.delegate = context.coordinator
        textView.font = .systemFont(ofSize: NSFont.systemFontSize)
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.string = text
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        textView.drawsBackground = false
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        let textView = scrollView.documentView as! NSTextView
        if textView.string != text {
            let selectedRanges = textView.selectedRanges
            textView.string = text
            textView.selectedRanges = selectedRanges
        }
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: NativeTextEditor

        init(_ parent: NativeTextEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
        }
    }
}
