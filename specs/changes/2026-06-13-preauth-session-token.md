---
release: acaa476
specs: [session-connection.md]
---

# Pre-auth select uses a session token

## Why

The new-character-on-existing-account path (Path B) sent the account id to
`/auth/select`. The server now requires a single-use session token issued by
`/auth/login` instead, so the client must capture and forward it. This change
ships in lockstep with engine v0.1.30; the two must deploy together.

## What

- On login, the client captures `session_token` from the `/auth/login` response.
- The Path B `/auth/select` request now sends `{ sessionToken, newCharacter }`
  instead of `{ accountId, newCharacter }` (src/preauth/LoginPage.tsx:356-384).
- `account_id` remains in the login response and is still used for display only.
- Path A (returning player via `/auth/login-by-character`) and Path C (register)
  are unchanged.
