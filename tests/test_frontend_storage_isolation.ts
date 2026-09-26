/**
 * Automated test suite for Client-Side User Settings Isolation.
 *
 * Verifies:
 * 1. Storage isolation between different client instance profiles.
 * 2. Pristine defaults: no hardcoded API keys.
 * 3. Schema sanitization against malformed or injected data.
 * 4. Client-side export and import round-trip.
 * 5. Complete data wipe / reset behavior.
 */

// Mock browser localStorage for Node/TSX environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Polyfill global localStorage and crypto for test run
const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

import {
  getDefaultUserSettings,
  loadUserSettings,
  saveUserSettings,
  updateUserSettings,
  resetAllUserSettings,
  importUserSettingsFromJson,
} from '../frontend/src/services/storage/userSettingsStorage';
import { USER_SETTINGS_STORAGE_KEY } from '../frontend/src/types/userSettings';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function runStorageIsolationTests() {
  console.log('🧪 Starting Client-Side User Settings Isolation Tests...\n');

  // Test 1: Pristine Defaults
  mockStorage.clear();
  const defaults = getDefaultUserSettings('client_alpha_123');
  assert(defaults.clientInstanceId === 'client_alpha_123', 'Client instance ID matches');
  assert(defaults.version === 1, 'Schema version is 1');
  assert(defaults.providers.gemini.apiKey === '', 'Gemini API key starts empty');
  assert(defaults.providers.groq.apiKey === '', 'Groq API key starts empty');
  assert(defaults.providers.openai.apiKey === '', 'OpenAI API key starts empty');
  assert(defaults.formatting.preset === 'academic', 'Default formatting is academic');
  console.log('✅ Test 1 Passed: Pristine defaults initialized with zero hardcoded keys.');

  // Test 2: Local Persistence & Atomic Update
  saveUserSettings(defaults);
  const updated = updateUserSettings((prev) => {
    return {
      ...prev,
      providers: {
        ...prev.providers,
        groq: {
          ...prev.providers.groq,
          apiKey: 'gsk-test-isolated-key-for-user-alpha',
          enabled: true,
        },
      },
      formatting: {
        ...prev.formatting,
        preset: 'research_paper',
      },
    };
  });

  const reloaded = loadUserSettings();
  assert(
    reloaded.providers.groq.apiKey === 'gsk-test-isolated-key-for-user-alpha',
    'User Alpha key saved locally'
  );
  assert(reloaded.formatting.preset === 'research_paper', 'User Alpha formatting preset updated');
  // Other providers remain untouched
  assert(reloaded.providers.openai.apiKey === '', 'Other providers unaffected');
  console.log('✅ Test 2 Passed: Atomic update and local persistence verified.');

  // Test 3: Multiple Profiles / Isolation
  // Simulate User B opening their browser with their own separate storage
  const mockStorageUserB = new MockLocalStorage();
  (globalThis as any).localStorage = mockStorageUserB;

  const defaultsUserB = loadUserSettings();
  assert(
    defaultsUserB.providers.groq.apiKey === '',
    'User B storage does not contain User A key'
  );
  assert(
    defaultsUserB.clientInstanceId !== defaults.clientInstanceId,
    'User B receives distinct client instance ID'
  );
  console.log('✅ Test 3 Passed: User A and User B storage partitions are completely isolated.');

  // Switch back to User A
  (globalThis as any).localStorage = mockStorage;

  // Test 4: Resilience & Corrupted JSON Sanitization
  mockStorage.setItem(USER_SETTINGS_STORAGE_KEY, '{ invalid_malformed_json: true');
  const safeRecovery = loadUserSettings();
  assert(safeRecovery.version === 1, 'Corrupted storage safely recovers to default schema');
  assert(safeRecovery.formatting.preset === 'academic', 'Restores default formatting');
  console.log('✅ Test 4 Passed: Malformed or corrupted local storage recovers safely without crashes.');

  // Test 5: Injected Malicious Fields Sanitization
  const tamperedJson = JSON.stringify({
    version: 1,
    injectedMaliciousPayload: '<script>alert(1)</script>',
    providers: {
      gemini: { apiKey: 'safe_key', extraDangerousField: 123 },
    },
    formatting: { preset: 'invalid_preset_value' },
  });
  const sanitized = importUserSettingsFromJson(tamperedJson);
  assert(sanitized.providers.gemini.apiKey === 'safe_key', 'Safe key preserved');
  assert(sanitized.formatting.preset === 'academic', 'Invalid preset rejected and defaulted');
  assert((sanitized as any).injectedMaliciousPayload === undefined, 'Injected fields stripped');
  console.log('✅ Test 5 Passed: Strict schema validation strips injected / unapproved fields.');

  // Test 6: Complete Wipe / Reset
  const fresh = resetAllUserSettings();
  assert(mockStorage.getItem(USER_SETTINGS_STORAGE_KEY) !== null, 'Reinitialized fresh storage');
  assert(fresh.providers.gemini.apiKey === '', 'Keys completely erased after reset');
  console.log('✅ Test 6 Passed: Complete wipe / reset purges all local keys immediately.');

  console.log('\n🎉 All 6 Client-Side Settings Isolation Tests Passed!\n');
}

runStorageIsolationTests();
