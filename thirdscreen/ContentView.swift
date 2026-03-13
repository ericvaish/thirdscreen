import SwiftUI
import AppKit

struct ContentView: View {
    @State private var todoStore: TodoStore
    let spotifyService: SpotifyService
    let calendarService: CalendarService
    let reminderService: ReminderService
    let googleCalendarService: GoogleCalendarService
    let shortcutsService: ShortcutsService
    let llmService: LocalLLMService
    let timerService: TimerService

    init(
        spotifyService: SpotifyService,
        calendarService: CalendarService,
        reminderService: ReminderService,
        googleCalendarService: GoogleCalendarService,
        shortcutsService: ShortcutsService,
        llmService: LocalLLMService,
        timerService: TimerService
    ) {
        _todoStore = State(initialValue: TodoStore(calendarService: calendarService, reminderService: reminderService))
        self.spotifyService = spotifyService
        self.calendarService = calendarService
        self.reminderService = reminderService
        self.googleCalendarService = googleCalendarService
        self.shortcutsService = shortcutsService
        self.llmService = llmService
        self.timerService = timerService
    }

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorScheme) private var colorScheme

    @AppStorage("dashboardLayout") private var legacyLayoutData: Data = (try? JSONEncoder().encode(DashboardLayout())) ?? Data()
    @AppStorage("dashboardLayoutV2") private var layoutDataV2: Data = Data()
    @AppStorage("layoutWorkspaceData") private var workspaceData: Data = Data()
    @AppStorage("dashboardEditMode") private var isEditMode = true
    @AppStorage("cardInstanceSettingsV1") private var cardSettingsData: Data = Data()

    @AppStorage(TimeCardPreferenceKey.clockPresentation) private var legacyClockPresentationRaw = TimeCardClockPresentation.digital.rawValue
    @AppStorage(TimeCardPreferenceKey.digitalStyle) private var legacyDigitalStyleRaw = TimeCardDigitalClockStyle.stacked.rawValue
    @AppStorage(TimeCardPreferenceKey.analogStyle) private var legacyAnalogStyleRaw = TimeCardAnalogClockStyle.railway.rawValue
    @AppStorage(TimeCardPreferenceKey.showSeconds) private var legacyShowSeconds = true
    @AppStorage(TimeCardPreferenceKey.use24Hour) private var legacyUse24Hour = false
    @AppStorage(TimeCardPreferenceKey.selectedTimeZoneID) private var legacySelectedTimeZoneID = TimeZone.current.identifier
    @AppStorage(TimeCardPreferenceKey.worldTimeZoneIDs) private var legacyWorldTimeZoneIDsRaw = TimeCardPreferences.defaultWorldTimeZoneIDsStorage
    @AppStorage("showLyrics") private var legacyShowLyrics = true

    @State private var committedLayout: DashboardLayoutV2 = .default
    @State private var previewLayout: DashboardLayoutV2?
    @State private var workspace: LayoutWorkspace = .default(from: .default)
    @State private var interactionSession: LayoutInteractionSession?
    @State private var activeCardID: UUID?
    @State private var cardSettingsStore: CardInstanceSettingsStore = .empty

    @State private var noteStores: [UUID: NoteStore] = [:]
    @State private var medicineStores: [UUID: MedicineStore] = [:]
    @State private var calorieStores: [UUID: CalorieStore] = [:]

    @State private var showAddCardCatalog = false
    @State private var showManageCards = false
    @State private var showLayoutPicker = false
    @State private var appSize: CGSize = CGSize(width: 900, height: 700)
    @State private var timeSettingsCardID: UUID?
    @State private var splitViewVisibility: NavigationSplitViewVisibility = .all
    @State private var sidebarSelection: UUID?
    @State private var pendingScrollTarget: UUID?

    @State private var keyMonitor: Any?

    private var engine: LayoutEngine {
        LayoutEngine(timeCardModeLookup: { instanceID in
            cardSettingsStore.timeConfig(for: instanceID)?.mode
        })
    }

    private var currentLayout: DashboardLayoutV2 {
        previewLayout ?? committedLayout
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $splitViewVisibility) {
            dashboardSidebar
                .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 320)
        } detail: {
            dashboardCanvas
        }
        .navigationSplitViewStyle(.balanced)
        .onChange(of: sidebarSelection) { _, cardID in
            guard let cardID else { return }
            focusCard(cardID)
        }
        .onChange(of: currentLayout.visibleCards.map(\.instanceID)) { _, visibleIDs in
            if let selected = sidebarSelection, !visibleIDs.contains(selected) {
                sidebarSelection = nil
            }
        }
        .onChange(of: activeCardID) { _, active in
            sidebarSelection = active
        }
        .background(colorScheme == .dark ? Color.black : Color.white)
        .frame(minWidth: 980, minHeight: 700)
        .background { WindowFrameSaver() }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    showLayoutPicker = true
                } label: {
                    Image(systemName: "square.grid.3x3.topleft.filled")
                }
                .help("Layouts Control Center")
                .accessibilityLabel("Layouts Control Center")
                .keyboardShortcut("l", modifiers: .command)
                .popover(isPresented: $showLayoutPicker, arrowEdge: .bottom) {
                    LayoutPickerView(
                        appSize: appSize,
                        currentLayout: committedLayout,
                        workspace: workspace,
                        isLayoutValid: engine.isValid(committedLayout),
                        onApplyProfile: applyProfile,
                        onSaveProfile: saveProfile,
                        onDuplicateProfile: duplicateProfile,
                        onDeleteProfile: deleteProfile,
                        onRenameProfile: renameProfile,
                        onTogglePin: togglePin,
                        onSetProfileRatioFromCurrent: setProfileRatioFromCurrent,
                        onClearProfileRatio: clearProfileRatio,
                        onSetAutoSaveEnabled: setAutoSaveEnabled
                    )
                }

                Button {
                    showAddCardCatalog = true
                } label: {
                    Image(systemName: "plus")
                }
                .help("Add card")
                .accessibilityLabel("Add card")

                Button {
                    showManageCards = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .help("Manage cards")
                .accessibilityLabel("Manage cards")

                Toggle(isOn: $isEditMode) {
                    Image(systemName: isEditMode ? "pencil.and.ruler" : "arrow.up.left.and.arrow.down.right")
                }
                .toggleStyle(.button)
                .help(isEditMode ? "Edit mode enabled" : "Edit mode disabled")

                Button {
                    openWindow(id: "settings")
                } label: {
                    Image(systemName: "gearshape")
                }
                .help("Settings")
                .accessibilityLabel("Settings")
            }
        }
        .sheet(isPresented: $showAddCardCatalog) {
            AddCardCatalogView { section in
                commitLayout(engine.addCard(kind: section, to: committedLayout))
            }
        }
        .sheet(isPresented: $showManageCards) {
            ManageCardsView(
                layout: committedLayout,
                displayName: { displayName(for: $0, in: committedLayout) },
                mediaConfig: { cardSettingsStore.mediaConfig(for: $0) },
                onSetHidden: { cardID, hidden in
                    commitLayout(engine.setCardHidden(cardID, hidden: hidden, in: committedLayout))
                },
                onRename: { cardID, title in
                    renameCard(cardID, title: title)
                },
                onDelete: { cardID in
                    deleteCard(cardID)
                },
                onSetMediaProvider: { cardID, provider in
                    setMediaProvider(cardID, provider: provider)
                }
            )
        }
        .task {
            loadPersistedStateIfNeeded()
            _ = await calendarService.requestAccess()
            await reminderService.refreshAuthorizationStatus()
            todoStore.refreshReminderSyncFromService()
            await googleCalendarService.refreshSessionAndEventsIfNeeded()
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await calendarService.refreshAuthorizationStatus()
                    await reminderService.refreshAuthorizationStatus()
                    todoStore.refreshReminderSyncFromService()
                    await googleCalendarService.refreshSessionAndEventsIfNeeded()
                }
            }
        }
        .onAppear {
            setupKeyMonitor()
        }
        .onDisappear {
            tearDownKeyMonitor()
        }
    }

    private var dashboardSidebar: some View {
        List(selection: $sidebarSelection) {
            Section("Cards") {
                ForEach(currentLayout.visibleCards, id: \.instanceID) { card in
                    HStack {
                        Label(displayName(for: card, in: currentLayout), systemImage: sidebarIcon(for: card.kind))
                        Spacer()
                        Menu {
                            Button(role: .destructive) {
                                deleteCard(card.instanceID)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .foregroundStyle(.secondary)
                                .frame(width: 20, height: 20)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .menuIndicator(.hidden)
                    }
                    .tag(Optional(card.instanceID))
                }
            }
        }
        .listStyle(.sidebar)
    }

    private var dashboardCanvas: some View {
        GeometryReader { geo in
            let insets: CGFloat = 16
            let paddedWidth = max(0, geo.size.width - insets * 2)
            let layout = currentLayout
            let metrics = layout.metrics(for: paddedWidth)
            let placedCards = layout.placedCards(availableWidth: paddedWidth)
            let totalHeight = placedCards.map { $0.frame.maxY }.max() ?? 0

            ScrollViewReader { scrollProxy in
                ScrollView {
                    ZStack(alignment: .topLeading) {
                        Color.clear
                            .frame(height: totalHeight)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                cancelInteraction()
                            }

                        ForEach(placedCards, id: \.card.instanceID) { placed in
                            dashboardCard(
                                placed: placed,
                                metrics: metrics,
                                scrollProxy: scrollProxy
                            )
                            .id(placed.card.instanceID.uuidString)
                            .frame(width: placed.frame.width, height: placed.frame.height)
                            .offset(x: placed.frame.minX, y: placed.frame.minY)
                            .animation(.interactiveSpring(response: 0.28, dampingFraction: 0.85), value: placed.card)
                        }
                    }
                    .padding(insets)
                    .padding(.top, 8)
                }
                .onAppear {
                    appSize = geo.size
                }
                .onChange(of: geo.size) { _, newSize in
                    appSize = newSize
                }
                .onChange(of: pendingScrollTarget) { _, target in
                    guard let target else { return }
                    withAnimation(.easeInOut(duration: 0.18)) {
                        scrollProxy.scrollTo(target.uuidString, anchor: .center)
                    }
                    pendingScrollTarget = nil
                }
            }
        }
    }

    private func sidebarIcon(for section: DashboardSection) -> String {
        switch section {
        case .timer:
            return "timer"
        case .media:
            return "music.note"
        case .schedule:
            return "calendar"
        case .battery:
            return "battery.75"
        case .calendar:
            return "command"
        case .todos:
            return "checklist"
        case .notes, .localNotes:
            return "note.text"
        case .icloudNotes:
            return "icloud"
        case .medicines:
            return "pills.fill"
        case .aiChat:
            return "sparkles"
        case .calories:
            return "flame.fill"
        }
    }

    private func focusCard(_ cardID: UUID) {
        guard currentLayout.visibleCards.contains(where: { $0.instanceID == cardID }) else { return }
        activeCardID = cardID
        if interactionSession == nil {
            pendingScrollTarget = cardID
        }
    }

    private func displayName(for card: CardPlacement, in layout: DashboardLayoutV2) -> String {
        if let title = card.trimmedTitle {
            return title
        }

        let siblings = layout.cards.filter { $0.kind == card.kind }
        if let index = siblings.firstIndex(where: { $0.instanceID == card.instanceID }) {
            return "\(card.kind.displayTitle) \(index + 1)"
        }
        return card.kind.displayTitle
    }

    // MARK: - Rendering

    private func dashboardCard(
        placed: PlacedCard,
        metrics: LayoutMetrics,
        scrollProxy: ScrollViewProxy
    ) -> some View {
        let card = placed.card
        let isActive = activeCardID == card.instanceID
        let canResize = isEditMode

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "line.3.horizontal")
                    .appScaledSystemFont(size: 12, weight: .medium)
                    .foregroundStyle(.tertiary)

                Text(displayName(for: card, in: currentLayout))
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Spacer()

                if card.kind == .timer {
                    Button {
                        timeSettingsCardID = card.instanceID
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Clock settings")
                    .accessibilityLabel("Clock settings")
                    .popover(
                        isPresented: Binding(
                            get: { timeSettingsCardID == card.instanceID },
                            set: { presented in
                                if !presented, timeSettingsCardID == card.instanceID {
                                    timeSettingsCardID = nil
                                }
                            }
                        ),
                        arrowEdge: .bottom
                    ) {
                        ScrollView {
                            TimeCardClockSettingsEditor(config: timeConfigBinding(for: card.instanceID))
                                .padding(12)
                        }
                        .frame(width: 350)
                    }
                }


                if isActive {
                    Text("\(card.w) × \(card.h)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.black.opacity(0.12), in: Capsule())
                }

            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .contentShape(Rectangle())
            .highPriorityGesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        guard isEditMode else { return }
                        beginInteraction(
                            kind: .drag,
                            cardID: card.instanceID,
                            pointerOrigin: value.startLocation
                        )
                        updateInteraction(
                            cardID: card.instanceID,
                            translation: value.translation,
                            metrics: metrics,
                            kind: .drag,
                            scrollProxy: scrollProxy
                        )
                    }
                    .onEnded { value in
                        guard isEditMode else { return }
                        endInteraction(
                            cardID: card.instanceID,
                            translation: value.translation,
                            metrics: metrics,
                            kind: .drag
                        )
                    }
            )

            Divider()

            contentForCard(card)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    isActive ? Color.accentColor : Color.secondary.opacity(0.3),
                    lineWidth: isActive ? 2.5 : 1
                )
                .allowsHitTesting(false)
        )
        .overlay(alignment: .trailing) {
            if canResize {
                resizeHandle(kind: .resizeWidth, card: card, metrics: metrics)
                    .padding(.trailing, 2)
            }
        }
        .overlay(alignment: .bottom) {
            if canResize {
                resizeHandle(kind: .resizeHeight, card: card, metrics: metrics)
                    .padding(.bottom, 2)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if canResize {
                resizeHandle(kind: .resizeBoth, card: card, metrics: metrics)
                    .padding(3)
            }
        }
        .shadow(color: isActive ? Color.accentColor.opacity(0.22) : .clear, radius: 10, y: 4)
        .opacity(isActive ? 0.96 : 1)
        .accessibilityLabel("\(displayName(for: card, in: currentLayout)), width \(card.w), height \(card.h), row \(card.y), column \(card.x)")
    }

    private func resizeHandle(kind: LayoutInteractionKind, card: CardPlacement, metrics: LayoutMetrics) -> some View {
        let cursor: NSCursor
        let size: CGSize
        let shapeColor = Color.secondary.opacity(0.65)
        let cornerRadii: RectangleCornerRadii

        switch kind {
        case .resizeWidth:
            cursor = NSCursor.resizeLeftRight
            size = CGSize(width: 14, height: 38)
            cornerRadii = RectangleCornerRadii(topLeading: 6, bottomLeading: 6, bottomTrailing: 6, topTrailing: 6)
        case .resizeHeight:
            cursor = NSCursor.resizeUpDown
            size = CGSize(width: 38, height: 14)
            cornerRadii = RectangleCornerRadii(topLeading: 6, bottomLeading: 6, bottomTrailing: 6, topTrailing: 6)
        case .resizeBoth:
            cursor = NSCursor.crosshair
            size = CGSize(width: 18, height: 18)
            cornerRadii = RectangleCornerRadii(topLeading: 6, bottomLeading: 6, bottomTrailing: 11, topTrailing: 6)
        case .drag:
            cursor = NSCursor.openHand
            size = CGSize(width: 0, height: 0)
            cornerRadii = RectangleCornerRadii(topLeading: 6, bottomLeading: 6, bottomTrailing: 6, topTrailing: 6)
        }

        return UnevenRoundedRectangle(cornerRadii: cornerRadii, style: .continuous)
            .fill(shapeColor)
            .frame(width: size.width, height: size.height)
            .onHover { inside in
                if inside {
                    cursor.push()
                } else {
                    NSCursor.pop()
                }
            }
            .highPriorityGesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        beginInteraction(kind: kind, cardID: card.instanceID, pointerOrigin: value.startLocation)
                        updateInteraction(
                            cardID: card.instanceID,
                            translation: value.translation,
                            metrics: metrics,
                            kind: kind,
                            scrollProxy: nil
                        )
                    }
                    .onEnded { value in
                        endInteraction(
                            cardID: card.instanceID,
                            translation: value.translation,
                            metrics: metrics,
                            kind: kind
                        )
                    }
            )
    }

    @ViewBuilder
    private func contentForCard(_ card: CardPlacement) -> some View {
        switch card.kind {
        case .timer:
            TimerView(config: timeConfigBinding(for: card.instanceID), timerService: timerService)
        case .media:
            MediaView(spotify: spotifyService, config: mediaConfigBinding(for: card.instanceID))
        case .schedule:
            ScheduleView(
                todoStore: todoStore,
                calendarService: calendarService,
                googleCalendarService: googleCalendarService
            )
        case .battery:
            BatteryView()
        case .calendar:
            ShortcutsView(shortcutsService: shortcutsService)
        case .todos:
            TodoListView(todoStore: todoStore)
        case .notes:
            NotesCardView(noteStore: noteStoreFor(card.instanceID, storageKind: .icloud))
        case .icloudNotes:
            NotesCardView(noteStore: noteStoreFor(card.instanceID, storageKind: .icloud))
        case .localNotes:
            NotesCardView(noteStore: noteStoreFor(card.instanceID, storageKind: .local))
        case .medicines:
            MedicinesCardView(medicineStore: medicineStoreFor(card.instanceID))
        case .aiChat:
            AIChatCardView(
                llmService: llmService,
                config: aiChatConfigBinding(for: card.instanceID),
                instanceID: card.instanceID
            )
        case .calories:
            CalorieCardView(calorieStore: calorieStoreFor(card.instanceID))
        }
    }

    private func noteStoreFor(_ instanceID: UUID, storageKind: NoteStorageKind) -> NoteStore {
        if let existing = noteStores[instanceID] {
            return existing
        }
        let store = NoteStore(instanceID: instanceID, storageKind: storageKind)
        DispatchQueue.main.async {
            noteStores[instanceID] = store
        }
        return store
    }

    private func medicineStoreFor(_ instanceID: UUID) -> MedicineStore {
        if let existing = medicineStores[instanceID] {
            return existing
        }
        let store = MedicineStore(instanceID: instanceID)
        DispatchQueue.main.async {
            medicineStores[instanceID] = store
        }
        return store
    }

    private func calorieStoreFor(_ instanceID: UUID) -> CalorieStore {
        if let existing = calorieStores[instanceID] {
            return existing
        }
        let store = CalorieStore(instanceID: instanceID)
        DispatchQueue.main.async {
            calorieStores[instanceID] = store
        }
        return store
    }

    // MARK: - Settings

    private func legacyTimeConfig() -> TimeCardConfig {
        TimeCardConfig(
            modeRaw: TimeCardMode.clock.rawValue,
            clockPresentationRaw: legacyClockPresentationRaw,
            digitalStyleRaw: legacyDigitalStyleRaw,
            analogStyleRaw: legacyAnalogStyleRaw,
            showSeconds: legacyShowSeconds,
            use24Hour: legacyUse24Hour,
            selectedTimeZoneID: legacySelectedTimeZoneID,
            worldTimeZoneIDsRaw: legacyWorldTimeZoneIDsRaw
        )
    }

    private func timeConfigBinding(for cardID: UUID) -> Binding<TimeCardConfig> {
        Binding(
            get: { cardSettingsStore.timeConfig(for: cardID) ?? .default },
            set: { newValue in
                let oldMode = cardSettingsStore.timeConfig(for: cardID)?.mode
                var next = cardSettingsStore
                next.setTimeConfig(newValue, for: cardID)
                cardSettingsStore = next
                persistCardSettings(next)

                // Re-sanitize layout when mode changes so min-size constraints update.
                if newValue.mode != oldMode {
                    let sanitized = engine.sanitize(committedLayout)
                    committedLayout = sanitized
                    persistLayout(sanitized)
                }
            }
        )
    }

    private func mediaConfigBinding(for cardID: UUID) -> Binding<MediaCardConfig> {
        Binding(
            get: { cardSettingsStore.mediaConfig(for: cardID) ?? .default },
            set: { newValue in
                var next = cardSettingsStore
                next.setMediaConfig(newValue, for: cardID)
                cardSettingsStore = next
                persistCardSettings(next)
            }
        )
    }

    private func aiChatConfigBinding(for cardID: UUID) -> Binding<AIChatCardConfig> {
        Binding(
            get: { cardSettingsStore.aiChatConfig(for: cardID) ?? .default },
            set: { newValue in
                var next = cardSettingsStore
                next.setAIChatConfig(newValue, for: cardID)
                cardSettingsStore = next
                persistCardSettings(next)
            }
        )
    }

    private func setMediaProvider(_ cardID: UUID, provider: MediaProvider) {
        var next = cardSettingsStore
        var config = next.mediaConfig(for: cardID) ?? .default
        config.provider = provider
        next.setMediaConfig(config, for: cardID)
        cardSettingsStore = next
        persistCardSettings(next)
    }

    // MARK: - Persistence and Workspace

    private func loadPersistedStateIfNeeded() {
        // Prefer file-based storage, fall back to @AppStorage / legacy.
        let fileLayoutData = StableDefaults.loadLayout()
        let effectiveV2Data = fileLayoutData ?? layoutDataV2
        let migrated = DashboardLayoutV2.decodeWithMigration(v2Data: effectiveV2Data, legacyData: legacyLayoutData) ?? .default
        let sanitized = engine.sanitize(migrated)
        committedLayout = sanitized

        let fileWorkspaceData = StableDefaults.loadWorkspace()
        let effectiveWorkspaceData = fileWorkspaceData ?? workspaceData
        if let decodedWorkspace = try? JSONDecoder().decode(LayoutWorkspace.self, from: effectiveWorkspaceData) {
            workspace = decodedWorkspace
        } else {
            workspace = .default(from: sanitized)
        }

        if workspace.lastStableLayout == nil {
            workspace.lastStableLayout = sanitized
        }

        let fileSettingsData = StableDefaults.loadCardSettings()
        let effectiveSettingsData = fileSettingsData ?? cardSettingsData
        var settings = (try? JSONDecoder().decode(CardInstanceSettingsStore.self, from: effectiveSettingsData)) ?? .empty
        settings.seedMissingFromLegacy(for: sanitized.cards, legacyTime: legacyTimeConfig(), legacyMediaShowLyrics: legacyShowLyrics)
        cardSettingsStore = settings

        persistLayout(sanitized)
        persistWorkspace(workspace)
        persistCardSettings(settings)
    }

    private func persistLayout(_ layout: DashboardLayoutV2) {
        if let data = try? JSONEncoder().encode(layout) {
            layoutDataV2 = data
            StableDefaults.saveLayout(data)
        }
    }

    private func persistWorkspace(_ workspace: LayoutWorkspace) {
        if let data = try? JSONEncoder().encode(workspace) {
            workspaceData = data
            StableDefaults.saveWorkspace(data)
        }
    }

    private func persistCardSettings(_ settings: CardInstanceSettingsStore) {
        if let data = try? JSONEncoder().encode(settings) {
            cardSettingsData = data
            StableDefaults.saveCardSettings(data)
        }
    }

    private func commitLayout(_ newLayout: DashboardLayoutV2, recordHistory: Bool = true) {
        let sanitized = engine.sanitize(newLayout)

        var nextWorkspace = workspace
        if recordHistory && sanitized != committedLayout {
            nextWorkspace.pushHistory(committedLayout)
        }

        if engine.isValid(sanitized) {
            nextWorkspace.lastStableLayout = sanitized
        }

        if nextWorkspace.autoSaveEnabled,
           let currentProfileID = nextWorkspace.currentProfileID,
           let profileIndex = nextWorkspace.profiles.firstIndex(where: { $0.id == currentProfileID }) {
            nextWorkspace.profiles[profileIndex].layout = sanitized
            nextWorkspace.profiles[profileIndex].updatedAt = .now
        }

        var nextSettings = cardSettingsStore
        nextSettings.ensureRuntimeDefaults(for: sanitized.cards)

        workspace = nextWorkspace
        committedLayout = sanitized
        previewLayout = nil

        if let activeCardID,
           !sanitized.visibleCards.contains(where: { $0.instanceID == activeCardID }) {
            self.activeCardID = nil
        }

        cardSettingsStore = nextSettings

        persistLayout(sanitized)
        persistWorkspace(nextWorkspace)
        persistCardSettings(nextSettings)
    }

    private func mutateCard(_ id: UUID, _ mutate: (inout CardPlacement) -> Void) {
        var next = committedLayout
        let columns = next.gridColumns
        next.updateCard(id) {
            mutate(&$0)
            $0 = $0.clamped(columns: columns)
        }
        commitLayout(next)
    }

    private func renameCard(_ cardID: UUID, title: String?) {
        mutateCard(cardID) { card in
            card.title = title
        }
    }

    private func deleteCard(_ cardID: UUID) {
        let updated = engine.removeCard(cardID, from: committedLayout)
        commitLayout(updated)

        var nextSettings = cardSettingsStore
        nextSettings.removeAllSettings(for: cardID)
        cardSettingsStore = nextSettings
        persistCardSettings(nextSettings)

        noteStores.removeValue(forKey: cardID)
        medicineStores.removeValue(forKey: cardID)
        calorieStores.removeValue(forKey: cardID)
    }

    // MARK: - Layout Actions

    private func undoLayout() {
        guard workspace.canUndo, let previous = workspace.history.last else { return }
        var nextWorkspace = workspace
        nextWorkspace.history.removeLast()
        nextWorkspace.future.append(committedLayout)
        workspace = nextWorkspace
        committedLayout = engine.sanitize(previous)
        previewLayout = nil
        persistLayout(committedLayout)
        persistWorkspace(nextWorkspace)
    }

    private func redoLayout() {
        guard workspace.canRedo, let upcoming = workspace.future.last else { return }
        var nextWorkspace = workspace
        nextWorkspace.future.removeLast()
        nextWorkspace.history.append(committedLayout)
        workspace = nextWorkspace
        committedLayout = engine.sanitize(upcoming)
        previewLayout = nil
        persistLayout(committedLayout)
        persistWorkspace(nextWorkspace)
    }

    private func recoverLastStable() {
        guard let stable = workspace.lastStableLayout else { return }
        commitLayout(stable)
    }

    private func autoFitCurrentLayout() {
        commitLayout(engine.sanitize(committedLayout))
    }

    private func normalizeLayoutSpacing() {
        commitLayout(engine.normalizedGapLayout(committedLayout))
    }

    private func setAutoSaveEnabled(_ enabled: Bool) {
        workspace.autoSaveEnabled = enabled
        persistWorkspace(workspace)
    }

    private func currentAspectRatioRange() -> LayoutRatioRange {
        guard appSize.height > 0 else { return LayoutRatioRange(min: 1, max: 1) }
        let ratio = appSize.width / appSize.height
        return LayoutRatioRange(min: max(0.5, ratio - 0.12), max: ratio + 0.12)
    }

    private func saveProfile(name: String, saveForCurrentRatio: Bool) {
        let profile = LayoutProfile(
            name: name,
            ratioRange: saveForCurrentRatio ? currentAspectRatioRange() : nil,
            layout: committedLayout,
            pinned: false
        )
        workspace.profiles.insert(profile, at: 0)
        workspace.currentProfileID = profile.id
        persistWorkspace(workspace)
    }

    private func applyProfile(_ profileID: UUID) {
        guard let profile = workspace.profiles.first(where: { $0.id == profileID }) else { return }
        workspace.currentProfileID = profileID
        persistWorkspace(workspace)
        commitLayout(profile.layout)
    }

    private func duplicateProfile(_ profileID: UUID) {
        guard let source = workspace.profiles.first(where: { $0.id == profileID }) else { return }
        var clone = source
        clone.id = UUID()
        clone.name = "\(source.name) Copy"
        clone.updatedAt = .now
        workspace.profiles.insert(clone, at: 0)
        persistWorkspace(workspace)
    }

    private func deleteProfile(_ profileID: UUID) {
        workspace.profiles.removeAll { $0.id == profileID }
        if workspace.currentProfileID == profileID {
            workspace.currentProfileID = workspace.profiles.first?.id
        }
        persistWorkspace(workspace)
    }

    private func renameProfile(_ profileID: UUID, _ name: String) {
        guard let index = workspace.profiles.firstIndex(where: { $0.id == profileID }) else { return }
        workspace.profiles[index].name = name
        workspace.profiles[index].updatedAt = .now
        persistWorkspace(workspace)
    }

    private func togglePin(_ profileID: UUID) {
        guard let index = workspace.profiles.firstIndex(where: { $0.id == profileID }) else { return }
        workspace.profiles[index].pinned.toggle()
        workspace.profiles[index].updatedAt = .now
        persistWorkspace(workspace)
    }

    private func setProfileRatioFromCurrent(_ profileID: UUID) {
        guard let index = workspace.profiles.firstIndex(where: { $0.id == profileID }) else { return }
        workspace.profiles[index].ratioRange = currentAspectRatioRange()
        workspace.profiles[index].updatedAt = .now
        persistWorkspace(workspace)
    }

    private func clearProfileRatio(_ profileID: UUID) {
        guard let index = workspace.profiles.firstIndex(where: { $0.id == profileID }) else { return }
        workspace.profiles[index].ratioRange = nil
        workspace.profiles[index].updatedAt = .now
        persistWorkspace(workspace)
    }

    // MARK: - Interactions

    private func beginInteraction(kind: LayoutInteractionKind, cardID: UUID, pointerOrigin: CGPoint) {
        if interactionSession?.anchorID == cardID && interactionSession?.kind == kind {
            return
        }

        let baseline = committedLayout
        interactionSession = LayoutInteractionSession(
            kind: kind,
            anchorID: cardID,
            startLayout: baseline,
            pointerOrigin: pointerOrigin,
            lastResolvedLayout: baseline
        )
        activeCardID = cardID
    }

    private func updateInteraction(
        cardID: UUID,
        translation: CGSize,
        metrics: LayoutMetrics,
        kind: LayoutInteractionKind,
        scrollProxy: ScrollViewProxy?
    ) {
        guard var session = interactionSession,
              session.anchorID == cardID,
              session.kind == kind,
              let sourceCard = session.startLayout.card(for: cardID)
        else { return }

        let proposedRect = resolvedCandidateRect(
            sourceCard: sourceCard,
            translation: translation,
            metrics: metrics,
            kind: kind,
            columns: session.startLayout.gridColumns
        )

        let resolved = engine.resolvedLayout(
            from: session.startLayout,
            activeCardID: cardID,
            proposedRect: proposedRect,
            compactAfter: false
        )

        session.lastResolvedLayout = resolved
        interactionSession = session
        previewLayout = resolved

        if let scrollProxy {
            withAnimation(.easeInOut(duration: 0.12)) {
                scrollProxy.scrollTo(cardID.uuidString, anchor: .center)
            }
        }
    }

    private func endInteraction(
        cardID: UUID,
        translation: CGSize,
        metrics: LayoutMetrics,
        kind: LayoutInteractionKind
    ) {
        guard let session = interactionSession,
              session.anchorID == cardID,
              session.kind == kind,
              let sourceCard = session.startLayout.card(for: cardID)
        else {
            cancelInteraction()
            return
        }

        let proposedRect = resolvedCandidateRect(
            sourceCard: sourceCard,
            translation: translation,
            metrics: metrics,
            kind: kind,
            columns: session.startLayout.gridColumns
        )

        let resolved = engine.resolvedLayout(
            from: session.startLayout,
            activeCardID: cardID,
            proposedRect: proposedRect,
            compactAfter: true
        )

        commitLayout(resolved)
        interactionSession = nil
        activeCardID = nil
    }

    private func resolvedCandidateRect(
        sourceCard: CardPlacement,
        translation: CGSize,
        metrics: LayoutMetrics,
        kind: LayoutInteractionKind,
        columns: Int
    ) -> GridRect {
        let deltaColumns = Int(round(translation.width / max(1, metrics.columnStep)))
        let deltaRows = Int(round(translation.height / max(1, metrics.rowStep)))

        var candidate = sourceCard.rect
        switch kind {
        case .drag:
            candidate.x += deltaColumns
            candidate.y += deltaRows
        case .resizeWidth:
            candidate.w += deltaColumns
        case .resizeHeight:
            candidate.h += deltaRows
        case .resizeBoth:
            candidate.w += deltaColumns
            candidate.h += deltaRows
        }

        var card = sourceCard
        card.rect = candidate
        card = card.clamped(columns: columns)
        return card.rect
    }

    private func cancelInteraction() {
        previewLayout = nil
        interactionSession = nil
        activeCardID = nil
        NSApp.keyWindow?.makeFirstResponder(nil)
    }

    private func nudgeActiveCard(dx: Int = 0, dy: Int = 0, dw: Int = 0, dh: Int = 0) {
        guard isEditMode, let activeCardID, let sourceCard = committedLayout.card(for: activeCardID) else { return }
        var proposed = sourceCard.rect
        proposed.x += dx
        proposed.y += dy
        proposed.w += dw
        proposed.h += dh

        let resolved = engine.resolvedLayout(
            from: committedLayout,
            activeCardID: activeCardID,
            proposedRect: proposed,
            compactAfter: true
        )
        commitLayout(resolved)
    }

    // MARK: - Keyboard

    private func setupKeyMonitor() {
        guard keyMonitor == nil else { return }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.keyCode == 53 {
                if interactionSession != nil || activeCardID != nil {
                    cancelInteraction()
                    return nil
                }
            }

            if isEditMode, activeCardID != nil {
                let isOption = event.modifierFlags.contains(.option)
                switch event.keyCode {
                case 123:
                    isOption ? nudgeActiveCard(dw: -1) : nudgeActiveCard(dx: -1)
                    return nil
                case 124:
                    isOption ? nudgeActiveCard(dw: 1) : nudgeActiveCard(dx: 1)
                    return nil
                case 125:
                    isOption ? nudgeActiveCard(dh: 1) : nudgeActiveCard(dy: 1)
                    return nil
                case 126:
                    isOption ? nudgeActiveCard(dh: -1) : nudgeActiveCard(dy: -1)
                    return nil
                default:
                    break
                }
            }
            return event
        }
    }

    private func tearDownKeyMonitor() {
        if let keyMonitor {
            NSEvent.removeMonitor(keyMonitor)
            self.keyMonitor = nil
        }
    }
}

#Preview {
    ContentView(
        spotifyService: SpotifyService(),
        calendarService: CalendarService(),
        reminderService: ReminderService(),
        googleCalendarService: GoogleCalendarService(),
        shortcutsService: ShortcutsService(),
        llmService: LocalLLMService(),
        timerService: TimerService()
    )
}
