import Foundation

struct LayoutValidationResult {
    var isValid: Bool
    var issues: [String]
}

struct LayoutEngine {
    func sanitize(_ layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var normalized = layout
        normalized.gridColumns = max(1, normalized.gridColumns)
        normalized.rowUnitHeight = max(24, normalized.rowUnitHeight)
        normalized.gap = max(4, normalized.gap)
        normalized.layoutVersion = DashboardLayoutV2.currentVersion

        var seen: Set<UUID> = []
        normalized.cards = normalized.cards.map { card in
            var next = card
            if seen.contains(next.instanceID) {
                next.instanceID = UUID()
            }
            seen.insert(next.instanceID)
            let policy = CardLayoutPolicy.policy(for: next.kind)
            next = policy.normalize(next, columns: normalized.gridColumns).applyingAspectLockIfNeeded()
            return next
        }

        return resolvedLayout(
            from: normalized,
            activeCardID: nil,
            proposedRect: nil,
            compactAfter: normalized.compactMode == .vertical
        )
    }

    func resolvedLayout(
        from layout: DashboardLayoutV2,
        activeCardID: UUID?,
        proposedRect: GridRect?,
        compactAfter: Bool
    ) -> DashboardLayoutV2 {
        var mutable = layout
        let columns = max(1, mutable.gridColumns)

        let visibleCards = mutable.cards.filter { !$0.isHidden }

        var cardsByID: [UUID: CardPlacement] = [:]
        for card in visibleCards {
            let policy = CardLayoutPolicy.policy(for: card.kind)
            cardsByID[card.instanceID] = policy.normalize(card, columns: columns)
        }

        if let activeCardID,
           var activeCard = cardsByID[activeCardID],
           let proposedRect {
            activeCard.rect = clampRect(proposedRect, card: activeCard, columns: columns)
            let policy = CardLayoutPolicy.policy(for: activeCard.kind)
            activeCard = policy.normalize(activeCard.applyingAspectLockIfNeeded(), columns: columns)
            cardsByID[activeCardID] = activeCard
        }

        let originalOrder = visibleCards.map(\.instanceID)
        var placementOrder: [UUID] = []
        if let activeCardID, originalOrder.contains(activeCardID) {
            placementOrder.append(activeCardID)
        }
        placementOrder.append(contentsOf: originalOrder.filter { $0 != activeCardID })

        var placed: [CardPlacement] = []
        for id in placementOrder {
            guard var candidate = cardsByID[id] else { continue }
            candidate = candidate.clamped(columns: columns)
            let desired = candidate.rect
            let resolvedRect = firstAvailableRect(
                desired: desired,
                width: candidate.w,
                height: candidate.h,
                columns: columns,
                existing: placed
            )
            candidate.rect = resolvedRect
            placed.append(candidate)
        }

        if compactAfter && mutable.compactMode == .vertical {
            placed = compactVertically(placed, columns: columns, preferredOrder: placementOrder)
        }

        let placedMap = Dictionary(uniqueKeysWithValues: placed.map { ($0.instanceID, $0) })
        for index in mutable.cards.indices {
            let card = mutable.cards[index]
            guard !card.isHidden else { continue }
            if let resolved = placedMap[card.instanceID] {
                mutable.cards[index] = resolved
            }
        }

        return mutable
    }

    func addCard(kind: DashboardSection, to layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        let defaultCard = DashboardLayoutV2.defaultCard(for: kind)
        updated.cards.append(defaultCard)
        return sanitize(updated)
    }

    func removeCard(_ instanceID: UUID, from layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        updated.removeCard(instanceID)
        return sanitize(updated)
    }

    func setCardHidden(_ instanceID: UUID, hidden: Bool, in layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        guard let existing = updated.card(for: instanceID) else { return layout }
        if existing.isHidden == hidden {
            return layout
        }

        updated.updateCard(instanceID) { card in
            card.isHidden = hidden
        }

        if hidden {
            return sanitize(updated)
        }

        guard let candidate = updated.card(for: instanceID) else { return sanitize(updated) }
        return resolvedLayout(
            from: updated,
            activeCardID: instanceID,
            proposedRect: candidate.rect,
            compactAfter: true
        )
    }

    func resetCard(_ instanceID: UUID, in layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        guard let existing = layout.card(for: instanceID) else { return layout }
        var updated = layout
        var defaults = DashboardLayoutV2.defaultCard(for: existing.kind, x: existing.x, y: existing.y)
        defaults.instanceID = existing.instanceID
        defaults.title = existing.title
        defaults.isHidden = existing.isHidden
        updated.replaceCard(defaults)
        return resolvedLayout(from: updated, activeCardID: instanceID, proposedRect: defaults.rect, compactAfter: true)
    }

    func withAllCardsLocked(_ locked: Bool, in layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        for index in updated.cards.indices {
            updated.cards[index].isLocked = locked
        }
        return updated
    }

    func normalizedGapLayout(_ layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        updated.gap = DashboardLayoutV2.defaultGap
        updated.rowUnitHeight = DashboardLayoutV2.defaultRowUnitHeight
        return sanitize(updated)
    }

    func validation(for layout: DashboardLayoutV2) -> LayoutValidationResult {
        var issues: [String] = []
        let columns = max(1, layout.gridColumns)

        var seen: Set<UUID> = []
        for card in layout.cards {
            let policy = CardLayoutPolicy.policy(for: card.kind)
            let effectiveMinW = min(max(1, policy.minW), columns)
            let effectiveMaxW = min(max(effectiveMinW, policy.maxW), columns)
            let effectiveMinH = max(1, policy.minH)
            let effectiveMaxH = max(effectiveMinH, policy.maxH)

            if seen.contains(card.instanceID) {
                issues.append("Duplicate card instanceID: \(card.instanceID.uuidString)")
            }
            seen.insert(card.instanceID)

            if card.minW != effectiveMinW || card.minH != effectiveMinH || card.maxW != effectiveMaxW || card.maxH != effectiveMaxH {
                issues.append("Card \(card.instanceID.uuidString) uses stale size policy")
            }

            if !card.isHidden {
                if card.w < effectiveMinW || card.w > effectiveMaxW {
                    issues.append("Card \(card.instanceID.uuidString) width out of range")
                }
                if card.h < effectiveMinH || card.h > effectiveMaxH {
                    issues.append("Card \(card.instanceID.uuidString) height out of range")
                }
                if card.x < 0 || card.x + card.w > columns {
                    issues.append("Card \(card.instanceID.uuidString) is out of horizontal bounds")
                }
                if card.y < 0 {
                    issues.append("Card \(card.instanceID.uuidString) has negative y")
                }
            }
        }

        let cards = layout.cards.filter { !$0.isHidden }
        if cards.count > 1 {
            for index in cards.indices {
                for otherIndex in cards.indices where otherIndex > index {
                    if cards[index].rect.intersects(cards[otherIndex].rect) {
                        issues.append("Cards overlap: \(cards[index].instanceID.uuidString), \(cards[otherIndex].instanceID.uuidString)")
                    }
                }
            }
        }

        return LayoutValidationResult(isValid: issues.isEmpty, issues: issues)
    }

    func isValid(_ layout: DashboardLayoutV2) -> Bool {
        validation(for: layout).isValid
    }

    // MARK: - Backward compatible wrappers

    func addSection(_ section: DashboardSection, to layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        addCard(kind: section, to: layout)
    }

    func removeSection(_ section: DashboardSection, from layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        var updated = layout
        updated.cards.removeAll { $0.kind == section }
        return sanitize(updated)
    }

    func resetCard(_ section: DashboardSection, in layout: DashboardLayoutV2) -> DashboardLayoutV2 {
        guard let existing = layout.cards.first(where: { $0.kind == section && !$0.isHidden }) ?? layout.cards.first(where: { $0.kind == section }) else {
            return layout
        }
        return resetCard(existing.instanceID, in: layout)
    }

    // MARK: - Internals

    private func compactVertically(_ cards: [CardPlacement], columns: Int, preferredOrder: [UUID]) -> [CardPlacement] {
        var byID = Dictionary(uniqueKeysWithValues: cards.map { ($0.instanceID, $0) })
        let order = preferredOrder.sorted { lhs, rhs in
            guard let left = byID[lhs], let right = byID[rhs] else { return lhs.uuidString < rhs.uuidString }
            if left.y != right.y { return left.y < right.y }
            if left.x != right.x { return left.x < right.x }
            return lhs.uuidString < rhs.uuidString
        }

        for id in order {
            guard var card = byID[id] else { continue }
            while card.y > 0 {
                var probe = card
                probe.y -= 1
                if canPlace(probe.rect, excluding: id, in: byID, columns: columns) {
                    card.y -= 1
                    byID[id] = card
                } else {
                    break
                }
            }
        }

        return preferredOrder.compactMap { byID[$0] }
    }

    private func firstAvailableRect(
        desired: GridRect,
        width: Int,
        height: Int,
        columns: Int,
        existing: [CardPlacement]
    ) -> GridRect {
        let clampedDesired = GridRect(
            x: min(max(0, desired.x), max(0, columns - width)),
            y: max(0, desired.y),
            w: width,
            h: height
        )

        if !collides(clampedDesired, with: existing) {
            return clampedDesired
        }

        let maxX = max(0, columns - width)

        if clampedDesired.x < maxX {
            for x in (clampedDesired.x + 1)...maxX {
                let probe = GridRect(x: x, y: clampedDesired.y, w: width, h: height)
                if !collides(probe, with: existing) {
                    return probe
                }
            }
        }

        if clampedDesired.x > 0 {
            for x in stride(from: clampedDesired.x - 1, through: 0, by: -1) {
                let probe = GridRect(x: x, y: clampedDesired.y, w: width, h: height)
                if !collides(probe, with: existing) {
                    return probe
                }
            }
        }

        let existingBottom = existing.map { $0.y + $0.h }.max() ?? 0
        let maxProbeRow = max(existingBottom + 40, clampedDesired.y + 160)
        if clampedDesired.y + 1 <= maxProbeRow {
            for row in (clampedDesired.y + 1)...maxProbeRow {
                for x in 0...maxX {
                    let probe = GridRect(x: x, y: row, w: width, h: height)
                    if !collides(probe, with: existing) {
                        return probe
                    }
                }
            }
        }

        var fallbackY = max(clampedDesired.y + 1, existingBottom)
        while true {
            for x in 0...maxX {
                let probe = GridRect(x: x, y: fallbackY, w: width, h: height)
                if !collides(probe, with: existing) {
                    return probe
                }
            }
            fallbackY += 1
        }
    }

    private func collides(_ rect: GridRect, with existing: [CardPlacement]) -> Bool {
        existing.contains { $0.rect.intersects(rect) }
    }

    private func clampRect(_ rect: GridRect, card: CardPlacement, columns: Int) -> GridRect {
        let w = min(max(rect.w, card.minW), min(card.maxW, columns))
        let h = min(max(rect.h, card.minH), card.maxH)
        let x = min(max(0, rect.x), max(0, columns - w))
        let y = max(0, rect.y)
        return GridRect(x: x, y: y, w: w, h: h)
    }

    private func canPlace(
        _ rect: GridRect,
        excluding cardID: UUID,
        in placements: [UUID: CardPlacement],
        columns: Int
    ) -> Bool {
        if rect.x < 0 || rect.y < 0 || rect.maxX > columns {
            return false
        }
        for (id, card) in placements where id != cardID {
            if rect.intersects(card.rect) {
                return false
            }
        }
        return true
    }
}
