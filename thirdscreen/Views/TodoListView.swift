//
//  TodoListView.swift
//  thirdscreen
//

import SwiftUI

private let durationPresets = [15, 20, 30, 45, 60, 90, 120]

struct DurationPickerView: View {
    @Binding var duration: Int

    var body: some View {
        Menu {
            ForEach(Array(durationPresets.enumerated()), id: \.offset) { _, mins in
                Button {
                    duration = mins
                } label: {
                    HStack {
                        Text("\(mins)m")
                        Spacer()
                        if duration == mins {
                            Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "hourglass")
                    .foregroundStyle(.secondary)
                Text("\(duration)m")
                Image(systemName: "chevron.down")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct TimePickerButton: View {
    @Binding var date: Date
    @State private var show = false

    var body: some View {
        Button {
            show.toggle()
        } label: {
            HStack(spacing: 6) {
                Text(formatted(date))
                    .font(.system(.body, design: .monospaced))
                Image(systemName: "chevron.down")
                    .appScaledSystemFont(size: 12, weight: .semibold)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .popover(isPresented: $show, arrowEdge: .bottom) {
            DatePicker("Time", selection: $date, displayedComponents: .hourAndMinute)
                .datePickerStyle(.stepperField)
                .labelsHidden()
                .padding(12)
                .frame(width: 220)
        }
    }

    private func formatted(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: d)
    }
}

struct TodoListView: View {
    @Bindable var todoStore: TodoStore
    @State private var newTodoTitle = ""
    @State private var newTodoStart = Date()
    @State private var newTodoDuration = 30
    @State private var editingItem: TodoItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    TextField("New to-do...", text: $newTodoTitle)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit { addTodo() }
                    Button { addTodo() } label: { Image(systemName: "plus.circle.fill") }
                        .buttonStyle(.plain)
                        .disabled(newTodoTitle.isEmpty)
                }
                HStack(spacing: 12) {
                    TimePickerButton(date: $newTodoStart)
                    Text("-").foregroundStyle(.secondary)
                    TimePickerButton(date: newTodoEndBinding)
                    DurationPickerView(duration: $newTodoDuration)
                }
            }
            List {
                ForEach(todoStore.items) { item in
                    TodoRow(
                        item: item,
                        onToggle: { todoStore.toggle(item) },
                        onDelete: { todoStore.remove(item) },
                        onEdit: { editingItem = item }
                    )
                }
            }
            .listStyle(.plain)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .sheet(item: $editingItem) { item in
            TodoFormSheet(
                title: "Edit To-Do",
                item: item,
                onSave: { title, blockTime, start, duration in
                    var updated = item
                    updated.title = title
                    updated.scheduledStart = blockTime ? start : nil
                    updated.durationMinutes = blockTime ? duration : nil
                    todoStore.update(updated)
                    editingItem = nil
                },
                onCancel: { editingItem = nil }
            )
            .padding(24)
            .frame(width: 360)
        }
    }

    private var newTodoEndBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(byAdding: .minute, value: max(1, newTodoDuration), to: newTodoStart)
                    ?? newTodoStart
            },
            set: { newEnd in
                let minutes = Int((newEnd.timeIntervalSince(newTodoStart) / 60.0).rounded())
                newTodoDuration = max(1, minutes)
            }
        )
    }

    private func addTodo() {
        guard !newTodoTitle.isEmpty else { return }
        let title = newTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines)

        let start = newTodoStart
        let duration = max(1, newTodoDuration)

        let item = TodoItem(
            title: title,
            scheduledStart: start,
            durationMinutes: duration
        )
        todoStore.add(item)
        newTodoTitle = ""
    }
}

struct TodoFormSheet: View {
    let title: String
    let item: TodoItem?
    let onSave: (String, Bool, Date, Int) -> Void
    let onCancel: () -> Void

    @State private var formTitle: String = ""
    @State private var formStart: Date = Date()
    @State private var formDuration: Int = 30

    var body: some View {
        VStack(spacing: 20) {
            Text(title).font(.title2)
            TextField("Title", text: $formTitle).textFieldStyle(.roundedBorder)
            VStack(alignment: .leading, spacing: 4) {
                Text("Start").font(.caption).foregroundStyle(.secondary)
                TimePickerButton(date: $formStart)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Duration").font(.caption).foregroundStyle(.secondary)
                DurationPickerView(duration: $formDuration)
            }
            HStack {
                Button("Cancel") { onCancel() }.buttonStyle(.bordered)
                Button("Save") {
                    onSave(formTitle, true, formStart, formDuration)
                }
                .buttonStyle(.borderedProminent)
                .disabled(formTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .onAppear {
            if let item {
                formTitle = item.title
                formStart = item.scheduledStart ?? Date()
                formDuration = item.durationMinutes ?? 30
            }
        }
    }
}

struct TodoRow: View {
    let item: TodoItem
    let onToggle: () -> Void
    let onDelete: () -> Void
    var onEdit: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { onToggle() } label: {
                Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.isCompleted ? .green : .secondary)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title).strikethrough(item.isCompleted).foregroundStyle(item.isCompleted ? .secondary : .primary)
                if let start = item.scheduledStart, let duration = item.durationMinutes {
                    Text(TodoRow.timeRangeString(start: start, duration: duration))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(role: .destructive) { onDelete() } label: { Image(systemName: "trash") }
                .buttonStyle(.plain)
            if let onEdit {
                Button { onEdit() } label: { Image(systemName: "pencil") }
                    .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
    }

    private static func timeRangeString(start: Date, duration: Int) -> String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        let end = start.addingTimeInterval(TimeInterval(duration * 60))
        return "\(f.string(from: start)) – \(f.string(from: end)) (\(duration)m)"
    }
}

#Preview {
    TodoListView(todoStore: TodoStore(calendarService: CalendarService()))
        .frame(width: 400, height: 400)
}
