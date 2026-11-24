# Privacy model

| Data | Where | Form |
|---|---|---|
| Sleep, steps, screen, mood, food, goals | IndexedDB on device | AES-256-GCM ciphertext |
| Consent flags, audit log | IndexedDB | Plaintext (no health values) |
| Passphrase / key | Memory only while unlocked | Never stored |
| Optional backup | Relay server | Ciphertext only, random mailbox id |

Limits: if the device is unlocked/compromised or the passphrase is weak, encryption does not help. A lost passphrase cannot be recovered. This is a wellness tool, not a medical device.
