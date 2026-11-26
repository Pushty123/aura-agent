# Privacy model

| Data | Where | Form |
|---|---|---|
| Sleep, steps, screen, mood, food, goals | IndexedDB on device | AES-256-GCM ciphertext |
| Routine and water settings, progress, and reminder responses | IndexedDB on device | AES-256-GCM ciphertext |
| Consent flags, audit log | IndexedDB | Plaintext (no health values) |
| Passphrase / key | Memory only while unlocked | Never stored |
| Optional backup | Relay server | Ciphertext only, random mailbox id |

Android reminder actions open AURA; when the vault is locked, unlock is required before a response can be saved. Missed routine items are recorded as no-response the next time the unlocked app checks them. Browser reminders require the tab to remain open and do not provide notification action buttons. The device/browser notification service temporarily holds the schedule and visible notification text so it can deliver the reminder; it stays on the device and may be visible on the lock screen.

Limits: if the device is unlocked/compromised or the passphrase is weak, encryption does not help. A lost passphrase cannot be recovered. This is a wellness tool, not a medical device.
