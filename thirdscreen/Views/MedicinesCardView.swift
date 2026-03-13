import SwiftUI

struct MedicinesCardView: View {
    @Bindable var medicineStore: MedicineStore
    @Environment(ToastManager.self) private var toastManager
    @State private var selectedMedicineID: UUID?
    @State private var showAddSheet = false
    @State private var selectedDate: Date = Date()
    @State private var weekOffset: Int = 0

    var body: some View {
        Group {
            if let medID = selectedMedicineID,
               let medicine = medicineStore.medicines.first(where: { $0.id == medID }) {
                MedicineDetailView(medicine: medicine, medicineStore: medicineStore) {
                    selectedMedicineID = nil
                }
            } else {
                mainPanel
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sheet(isPresented: $showAddSheet) {
            AddMedicineSheet(medicineStore: medicineStore) { medicine in
                selectedMedicineID = medicine.id
                showAddSheet = false
            } onCancel: {
                showAddSheet = false
            }
        }
    }

    // MARK: - Main Panel

    private var mainPanel: some View {
        VStack(spacing: 0) {
            WeekStripView(selectedDate: $selectedDate, weekOffset: $weekOffset) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Add medicine")
            }

            Divider()
                .padding(.horizontal, 10)

            // Dose checklist
            let meds = medicineStore.medicines(for: selectedDate)
            if meds.isEmpty {
                Spacer()
                Text("No medicines scheduled")
                    .appScaledSystemFont(size: 12)
                    .foregroundStyle(.tertiary)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 3) {
                        ForEach(meds) { med in
                            ForEach(med.times) { time in
                                doseCheckRow(med: med, time: time)
                            }
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func doseCheckRow(med: MedicineItem, time: MedicineTime) -> some View {
        let taken = medicineStore.isDoseTaken(medicineID: med.id, timeID: time.id, date: selectedDate)
        return HStack(spacing: 10) {
            Image(systemName: taken ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(taken ? .green : .secondary)
                .appScaledSystemFont(size: 16)

            VStack(alignment: .leading, spacing: 1) {
                Text(med.name.isEmpty ? "Untitled" : med.name)
                    .appScaledSystemFont(size: 13, weight: .medium)
                    .strikethrough(taken)
                    .foregroundStyle(taken ? .secondary : .primary)
                HStack(spacing: 4) {
                    Text(time.displayString)
                        .appScaledSystemFont(size: 11)
                        .foregroundStyle(.tertiary)
                    if !med.dosage.isEmpty {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(med.dosage)
                            .appScaledSystemFont(size: 11)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer()

            if taken {
                Text("Taken")
                    .appScaledSystemFont(size: 10, weight: .medium)
                    .foregroundStyle(.green)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.green.opacity(0.1), in: Capsule())
            }
        }
        .padding(.vertical, 5)
        .padding(.horizontal, 8)
        .background(.quaternary.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
        .contentShape(Rectangle())
        .onTapGesture {
            if taken {
                medicineStore.unmarkDose(medicineID: med.id, timeID: time.id, date: selectedDate)
            } else {
                medicineStore.markDoseTaken(medicineID: med.id, timeID: time.id, date: selectedDate)
                toastManager.show(ToastItem(
                    icon: "pills.fill",
                    iconColor: .green,
                    title: "\(med.name) Taken",
                    subtitle: med.dosage.isEmpty ? nil : med.dosage
                ))
            }
        }
        .contextMenu {
            Button("Edit") {
                selectedMedicineID = med.id
            }
            Button(med.isActive ? "Deactivate" : "Activate") {
                medicineStore.toggleActive(med)
            }
            Divider()
            Button("Delete", role: .destructive) {
                medicineStore.delete(med)
            }
        }
    }
}

// MARK: - Medicine Detail View

struct MedicineDetailView: View {
    let medicine: MedicineItem
    @Bindable var medicineStore: MedicineStore
    var onBack: () -> Void

    @State private var editingName = false
    @State private var editingDosage = false
    @State private var nameDraft = ""
    @State private var dosageDraft = ""
    @State private var localMedicine: MedicineItem?

    private var med: MedicineItem { localMedicine ?? medicine }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Back button
                Button {
                    onBack()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .appScaledSystemFont(size: 12)
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                headerSection
                Divider()
                todayDosesSection
                Divider()
                scheduleSection
                Divider()
                daysSection
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onAppear {
            localMedicine = medicine
        }
        .onChange(of: medicine) { _, newValue in
            localMedicine = newValue
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Name
            if editingName {
                HStack(spacing: 6) {
                    TextField("Medicine name", text: $nameDraft)
                        .textFieldStyle(.roundedBorder)
                        .appScaledSystemFont(size: 14)
                        .onSubmit { saveName() }
                    Button("Save") { saveName() }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            } else {
                HStack(spacing: 6) {
                    Text(med.name.isEmpty ? "Untitled" : med.name)
                        .appScaledSystemFont(size: 18, weight: .semibold)
                    Button {
                        nameDraft = med.name
                        editingName = true
                    } label: {
                        Image(systemName: "pencil")
                            .appScaledSystemFont(size: 11)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Toggle("Active", isOn: Binding(
                        get: { med.isActive },
                        set: { newValue in
                            var updated = med
                            updated.isActive = newValue
                            localMedicine = updated
                            medicineStore.update(updated)
                        }
                    ))
                    .toggleStyle(.switch)
                    .controlSize(.small)
                    .appScaledSystemFont(size: 11)
                }
            }

            // Dosage
            if editingDosage {
                HStack(spacing: 6) {
                    TextField("Dosage (e.g. 500mg)", text: $dosageDraft)
                        .textFieldStyle(.roundedBorder)
                        .appScaledSystemFont(size: 12)
                        .onSubmit { saveDosage() }
                    Button("Save") { saveDosage() }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            } else {
                HStack(spacing: 4) {
                    Text(med.dosage.isEmpty ? "No dosage set" : med.dosage)
                        .appScaledSystemFont(size: 12)
                        .foregroundStyle(med.dosage.isEmpty ? .tertiary : .secondary)
                    Button {
                        dosageDraft = med.dosage
                        editingDosage = true
                    } label: {
                        Image(systemName: "pencil")
                            .appScaledSystemFont(size: 9)
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Today's Doses

    private var todayDosesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Today's Doses")
                .appScaledSystemFont(size: 12, weight: .semibold)
                .foregroundStyle(.secondary)

            if !med.isScheduledToday() {
                Text("Not scheduled today")
                    .appScaledSystemFont(size: 12)
                    .foregroundStyle(.tertiary)
            } else if med.times.isEmpty {
                Text("No times set")
                    .appScaledSystemFont(size: 12)
                    .foregroundStyle(.tertiary)
            } else {
                ForEach(med.times) { time in
                    doseRow(time: time)
                }
            }
        }
    }

    private func doseRow(time: MedicineTime) -> some View {
        let taken = medicineStore.isDoseTaken(medicineID: med.id, timeID: time.id)
        return HStack(spacing: 10) {
            Button {
                if taken {
                    medicineStore.unmarkDose(medicineID: med.id, timeID: time.id)
                } else {
                    medicineStore.markDoseTaken(medicineID: med.id, timeID: time.id)
                }
            } label: {
                Image(systemName: taken ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(taken ? .green : .secondary)
                    .appScaledSystemFont(size: 16)
            }
            .buttonStyle(.plain)

            Text(time.displayString)
                .appScaledSystemFont(size: 13)
                .strikethrough(taken)
                .foregroundStyle(taken ? .secondary : .primary)

            Spacer()

            if taken {
                Text("Taken")
                    .appScaledSystemFont(size: 10, weight: .medium)
                    .foregroundStyle(.green)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.green.opacity(0.1), in: Capsule())
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(.quaternary.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Schedule (Times)

    private var scheduleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Times")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    var updated = med
                    updated.times.append(MedicineTime())
                    localMedicine = updated
                    medicineStore.update(updated)
                } label: {
                    Image(systemName: "plus.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Add time")
            }

            ForEach(Array(med.times.enumerated()), id: \.element.id) { index, time in
                HStack(spacing: 8) {
                    DatePicker(
                        "",
                        selection: Binding(
                            get: { time.asDate },
                            set: { newDate in
                                let comps = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                                var updated = med
                                updated.times[index].hour = comps.hour ?? 8
                                updated.times[index].minute = comps.minute ?? 0
                                localMedicine = updated
                                medicineStore.update(updated)
                            }
                        ),
                        displayedComponents: .hourAndMinute
                    )
                    .labelsHidden()
                    .datePickerStyle(.stepperField)

                    Spacer()

                    if med.times.count > 1 {
                        Button {
                            var updated = med
                            updated.times.remove(at: index)
                            localMedicine = updated
                            medicineStore.update(updated)
                        } label: {
                            Image(systemName: "minus.circle")
                                .foregroundStyle(.red.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - Days

    private var daysSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Repeat")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
                Spacer()
                Picker("", selection: Binding(
                    get: { med.repeatPattern },
                    set: { newPattern in
                        var updated = med
                        updated.repeatPattern = newPattern
                        switch newPattern {
                        case .daily:
                            updated.activeDays = Array(repeating: true, count: 7)
                        case .weekly:
                            // Keep current selection but ensure at least one day
                            if !updated.activeDays.contains(true) {
                                let today = Calendar.current.component(.weekday, from: Date()) - 1
                                updated.activeDays[today] = true
                            }
                        case .custom:
                            break
                        }
                        localMedicine = updated
                        medicineStore.update(updated)
                    }
                )) {
                    ForEach(MedicineRepeatPattern.allCases, id: \.self) { pattern in
                        Text(pattern.label).tag(pattern)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }

            if med.repeatPattern != .daily {
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { dayIndex in
                        dayToggle(dayIndex: dayIndex)
                    }
                }
            }
        }
    }

    private func dayToggle(dayIndex: Int) -> some View {
        let isOn = med.activeDays.indices.contains(dayIndex) && med.activeDays[dayIndex]
        return Button {
            var updated = med
            updated.activeDays[dayIndex].toggle()
            // Ensure at least one day stays active
            if !updated.activeDays.contains(true) {
                updated.activeDays[dayIndex] = true
                return
            }
            localMedicine = updated
            medicineStore.update(updated)
        } label: {
            Text(MedicineItem.dayLetters[dayIndex])
                .appScaledSystemFont(size: 11, weight: .semibold)
                .frame(width: 28, height: 28)
                .background(isOn ? Color.accentColor : Color.gray.opacity(0.2), in: Circle())
                .foregroundStyle(isOn ? .white : .secondary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func saveName() {
        var updated = med
        updated.name = nameDraft
        localMedicine = updated
        medicineStore.update(updated)
        editingName = false
    }

    private func saveDosage() {
        var updated = med
        updated.dosage = dosageDraft
        localMedicine = updated
        medicineStore.update(updated)
        editingDosage = false
    }
}

// MARK: - Add Medicine Sheet

struct AddMedicineSheet: View {
    @Bindable var medicineStore: MedicineStore
    var onAdded: (MedicineItem) -> Void
    var onCancel: () -> Void

    @State private var name = ""
    @State private var dosage = ""
    @State private var times: [MedicineTime] = [MedicineTime()]
    @State private var repeatPattern: MedicineRepeatPattern = .daily
    @State private var activeDays: [Bool] = Array(repeating: true, count: 7)
    @FocusState private var nameFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add Medicine")
                .font(.headline)

            TextField("Medicine name", text: $name)
                .textFieldStyle(.roundedBorder)
                .focused($nameFieldFocused)

            TextField("Dosage (e.g. 500mg, 1 tablet)", text: $dosage)
                .textFieldStyle(.roundedBorder)

            // Times
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Times")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Button {
                        times.append(MedicineTime(hour: 12, minute: 0))
                    } label: {
                        Image(systemName: "plus.circle")
                    }
                    .buttonStyle(.plain)
                }
                ForEach(Array(times.enumerated()), id: \.element.id) { index, time in
                    HStack {
                        DatePicker(
                            "",
                            selection: Binding(
                                get: { time.asDate },
                                set: { newDate in
                                    let comps = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                                    times[index].hour = comps.hour ?? 8
                                    times[index].minute = comps.minute ?? 0
                                }
                            ),
                            displayedComponents: .hourAndMinute
                        )
                        .labelsHidden()
                        .datePickerStyle(.stepperField)

                        if times.count > 1 {
                            Button {
                                times.remove(at: index)
                            } label: {
                                Image(systemName: "minus.circle")
                                    .foregroundStyle(.red.opacity(0.7))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Repeat pattern
            VStack(alignment: .leading, spacing: 6) {
                Text("Repeat")
                    .font(.subheadline.weight(.medium))
                Picker("", selection: $repeatPattern) {
                    ForEach(MedicineRepeatPattern.allCases, id: \.self) { pattern in
                        Text(pattern.label).tag(pattern)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: repeatPattern) { _, newValue in
                    if newValue == .daily {
                        activeDays = Array(repeating: true, count: 7)
                    }
                }

                if repeatPattern != .daily {
                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { dayIndex in
                            Button {
                                activeDays[dayIndex].toggle()
                                if !activeDays.contains(true) {
                                    activeDays[dayIndex] = true
                                }
                            } label: {
                                Text(MedicineItem.dayLetters[dayIndex])
                                    .font(.caption.weight(.semibold))
                                    .frame(width: 30, height: 30)
                                    .background(activeDays[dayIndex] ? Color.accentColor : Color.gray.opacity(0.2), in: Circle())
                                    .foregroundStyle(activeDays[dayIndex] ? .white : .secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 2)
                }
            }

            HStack {
                Spacer()
                Button("Cancel") { onCancel() }
                    .keyboardShortcut(.cancelAction)
                Button("Add") {
                    var med = MedicineItem(
                        name: name,
                        dosage: dosage,
                        times: times,
                        repeatPattern: repeatPattern,
                        activeDays: activeDays
                    )
                    med = medicineStore.addMedicine(name: name, dosage: dosage)
                    // Update with full config
                    var updated = med
                    updated.times = times
                    updated.repeatPattern = repeatPattern
                    updated.activeDays = activeDays
                    medicineStore.update(updated)
                    onAdded(updated)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 380)
        .onAppear {
            nameFieldFocused = true
        }
    }
}
