---
id: "ft_Y_07"
title: "Content packs and sync"
scope: "Piece packs from parents and teachers; optional cloud sync"
effort: "high friction"
status: "idea"
completeness: 0
---
# ft_Y_07: Content packs and sync

Piece packs from parents and teachers, and optional cloud sync of progress; write a plan before starting. Index: [FEATURES.md](FEATURES.md).

## Rules (planned)

- **Packs:** content is loaded through a manifest with ids, versions, licence and status, and the approval gate is data (`docs/futureproofing.md` section 2), so a pack is more pieces through the same compiler, linter and gate. Own pieces written in the editor (ft_1_02) have licence `NaN`, stay private and are never part of a shared pack.
- **Sync:** saves are local, per player and exportable as JSON (ft_0_10). Cloud sync is a children's-data and privacy question first (consent, minimal data), and a technical one second (`docs/futureproofing.md` 1.5).
- **Not planned:** a pack marketplace, accounts, any server.
