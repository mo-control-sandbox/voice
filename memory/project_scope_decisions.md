---
name: MōVoice scope decisions
description: Explicit features excluded from the current implementation scope
type: project
---

PTT (push-to-talk) key-up detection via CGEventTap is **out of scope**.

**Why:** Requires native CGEventTap infrastructure; deferred by user decision on 2026-04-14.

**How to apply:** ShortcutManager should only implement toggle mode for now. Do not implement PTT or combined shortcut modes. The `native.system.MonitorKeyUp` / `StopKeyUpMonitor` methods should not be added to SystemServiceImpl.
