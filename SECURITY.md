# FormatAI Security & Client-Side Isolation Model

## 1. Overview and Design Principles

FormatAI is an academic document formatting engine and multi-provider AI assistant. A foundational architectural requirement of FormatAI is **strict client-side isolation of all user-specific data and credentials**.

User data—including AI provider API keys, custom base URLs, provider enabled/disabled states, selected models, layout presets, citation styles, document cleaning preferences, UI configurations, and skill preferences—is **strictly partitioned to the individual user's browser client**.

### Core Tenets:
- **No Shared Server-Side Database**: The backend does not maintain any user table, credentials database, or multi-tenant settings cache.
- **No Shared Global State**: Settings are not held in global browser `window` variables or shared across modules unsafely.
- **No Hardcoded Keys**: The application codebase contains zero hardcoded API keys or provider tokens.
- **Zero Server-Side Exposure**: The backend cannot return User A's settings or keys to User B under any circumstances.

---

## 2. Separation of Concerns: Client-Local vs. Server Configuration

| Attribute | Client-Local Settings | Server-Side Application Configuration |
| :--- | :--- | :--- |
| **Storage Medium** | Browser `localStorage` (`formatai_client_settings_v1`) | Read-only container environment variables (`.env`) |
| **Contents** | User API keys, custom endpoint URLs, provider toggles, active model, formatting presets, citation preferences, UI preferences | Default server ports, CORS origins, default fallback model alias |
| **Scope** | Single browser profile / origin boundary | Global server process execution |
| **Persistence** | Retained locally in user's browser until cleared | Static throughout container lifecycle |
| **Exposure Boundary** | Never broadcast or written to server databases | Server-side only; never returned in HTTP bodies |

---

## 3. The Four Core Security Pillars

To ensure technical precision and avoid false security claims, FormatAI clearly distinguishes between **isolation**, **confidentiality**, **encryption**, and **server-side exposure**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Origin Partition (Same-Origin Policy): http://localhost:3000          │  │
│  │                                                                       │  │
│  │  • Client Instance UUID: client_xxxx-xxxx-xxxx                        │  │
│  │  • API Keys (Gemini, Groq, OpenRouter, Mistral, Cohere, OpenAI, etc.) │  │
│  │  • User Preferences (Formatting, Citations, UI, Document Pipeline)    │  │
│  │                                                                       │  │
│  │  [Storage Engine: localStorage (Plaintext at-rest, origin-isolated)]  │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Ephemeral HTTPS / TLS
                                       │ (Scoped to request execution)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI PYTHON BACKEND                             │
│                                                                             │
│  • Pure in-memory execution of request.provider_config                       │
│  • Dispatches prompt to target adapter                                      │
│  • Memory wiped on response return                                          │
│  • ZERO database writes · ZERO Redis caches · ZERO telemetry of user keys   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pillar A: Isolation (Origin & Profile Segregation)
- **Mechanism**: Enforced by the browser's **Same-Origin Policy (SOP)**. Web Storage (`localStorage`) is segregated by protocol, domain, and port (`schema://host:port`).
- **Profile Partitioning**: Different browser profiles (e.g. Chrome Profile 1 vs. Profile 2), different browsers (Firefox vs. Chrome), and private/incognito windows have physically isolated storage partitions.
- **Client Instance Identifier**: Each browser installation generates a persistent, random `clientInstanceId` (UUIDv4) upon first initialization, ensuring unambiguous client partitioning.
- **Zero Cross-Contamination**: User A using their browser cannot access, read, or overwrite the local storage of User B on another device or profile.

### Pillar B: Confidentiality (Ephemeral Memory Lifetime)
- **Transit Protection**: User API keys are only transmitted from the frontend to the backend when an explicit action is taken (e.g., "Run AI Assistant" or "Test Connection & Credentials").
- **Ephemeral Backend Lifetime**: When credentials reach the Python backend, they exist strictly as temporary function arguments in volatile memory for the duration of that single asynchronous HTTP request.
- **No Logging or Caching**: Backend loggers explicitly suppress sensitive fields. API keys are never written to log files, cache tables, or serialized to disk.
- **Garbage Collection**: Once the AI provider HTTP response is returned, the provider instance is dereferenced and eligible for immediate garbage collection.

### Pillar C: Encryption (Storage Truth & Security Boundaries)
- **Important Disclosure**: **Browser `localStorage` is NOT cryptographically encrypted at rest.**
  - `localStorage` stores strings in cleartext within the browser’s local profile directory on the user’s operating system disk.
  - Any browser extension with storage permissions or any script executing within the same origin has read access to `localStorage`.
- **Why We Do Not Fake Client-Side Encryption**:
  - Encrypting data in client-side JavaScript using a hardcoded key or a key derived in JS provides **obfuscation, not cryptographic security**, because the decryption key and algorithm must reside in the same client environment.
  - Calling client-side obfuscation "encryption" creates a dangerous false sense of security.
- **True Cryptographic Protections Applied**:
  - **Transport Layer Security (TLS/HTTPS)**: Protects all client-to-backend and backend-to-provider communications against eavesdropping and man-in-the-middle (MITM) attacks.
  - **Physical Device Security Requirement**: Users operating on shared, untrusted workstations should utilize Private/Incognito browsing or click **"Wipe All Local Settings"** upon ending their session.

### Pillar D: Server-Side Exposure (Zero Shared Persistence)
- **No User Settings Table**: The backend has no database model for user profiles or settings.
- **No Settings Endpoints**: There are no `/api/user/settings` GET/PUT/POST endpoints. The backend cannot return another user's stored settings because it does not store any.
- **Concurrent Request Isolation**: Concurrent requests from different users are handled by independent, isolated coroutines in Python `asyncio`. The state of Request A never touches Request B.
- **Response Sanitization**: Error handlers and response serializers strictly scrub metadata, ensuring raw user credentials are never echoed back in response payloads.

---

## 4. User-Local Data Inventory

The following categories of data are classified as **User-Local Data** and are governed by this client-isolation model:

| Data Category | Specific Fields | Location |
| :--- | :--- | :--- |
| **API Keys** | Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace, OpenAI keys | Browser `localStorage` |
| **Provider States** | `enabled` (boolean flag per provider) | Browser `localStorage` |
| **Active AI Routing** | `selectedProvider`, `selectedModel`, `fallbackProviders`, `temperature` | Browser `localStorage` |
| **Formatting Preferences** | Layout `preset`, `citationStyle`, `includePageNumbers`, `includeHeader`, `fontFamily`, `fontSizePt`, `lineSpacing`, `marginInches` | Browser `localStorage` |
| **Document Preferences** | `autoCleanArtifacts`, `preserveMathEnvironments`, `defaultExportFormat`, `autoAnalyzeOnChange` | Browser `localStorage` |
| **UI Preferences** | `themeMode`, `previewZoomPercent`, `compactControls`, `showDocumentStats`, `activeMobileTab` | Browser `localStorage` |
| **Skill Preferences** | `academicSynthesisEnabled`, `latexStandardizationEnabled`, `conversationalDenoisingEnabled`, `strictCitationFormatting` | Browser `localStorage` |

---

## 5. User Control & Data Sovereignty

Users have complete autonomy over their stored data:

1. **Export Local Profile (JSON)**:
   - Users can export their entire local profile to a `.json` backup file.
   - The export process is executed **100% in browser memory** using `Blob` and `URL.createObjectURL`. The data is never sent to the server.
2. **Import Local Profile (JSON)**:
   - Users can import a previously exported profile into another browser.
   - The file is read locally using the browser's `FileReader` API and passed through a strict schema sanitizer that strips unapproved or malicious properties before persisting.
3. **Wipe All Local Settings (Irreversible Reset)**:
   - One-click purge available under the **Settings & Privacy** modal ("Danger Zone").
   - Immediately invokes `localStorage.removeItem()` for all keys, erases client UUIDs, and resets the interface to factory defaults.

---

## 6. Automated Verification Matrix

The isolation architecture is backed by automated tests:

| Test File | Test Case | Guarantee Verified |
| :--- | :--- | :--- |
| `tests/test_settings_isolation.py` | `test_no_server_side_user_settings_endpoint` | Proves backend returns 404 for any user settings endpoints |
| `tests/test_settings_isolation.py` | `test_public_provider_catalog_never_exposes_user_keys` | Proves `GET /api/ai/providers` exposes zero credentials or keys |
| `tests/test_settings_isolation.py` | `test_concurrent_requests_remain_strictly_isolated` | Proves concurrent requests with different user keys execute in isolated memory without leakage |
| `tests/test_settings_isolation.py` | `test_api_generate_response_does_not_echo_secret_keys` | Proves backend never echoes client credentials in responses or error payloads |
| `tests/test_frontend_storage_isolation.ts` | `Pristine Defaults` | Proves initial state contains no prefilled or hardcoded API keys |
| `tests/test_frontend_storage_isolation.ts` | `Partition Isolation` | Proves User A and User B storage partitions cannot access each other |
| `tests/test_frontend_storage_isolation.ts` | `Sanitization & Injection Defense` | Proves malformed or malicious injected JSON fields are safely stripped |
| `tests/test_frontend_storage_isolation.ts` | `Complete Wipe / Reset` | Proves reset immediately purges all keys from browser storage |
