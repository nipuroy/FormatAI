/**
 * FormatAI Client-Side User Settings Storage Manager.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Storage Location: Browser-local storage (`localStorage`) scoped strictly to the current origin.
 * 2. Zero Server State: This module NEVER transmits entire settings schemas or API keys to any
 *    server-side repository, database, or shared caching layer.
 * 3. Isolation: Settings are segregated per browser instance/profile.
 * 4. Resilient Fallbacks: Malformed, corrupted, or tampered storage entries safely reset to
 *    hardened defaults without crashing the frontend.
 *
 * IMPORTANT SECURITY NOTE:
 * Browser `localStorage` provides origin-level isolation, NOT at-rest cryptographic encryption.
 * Any script running within this origin has read/write access. For untrusted shared physical devices,
 * users should use private browser profiles or invoke "Reset All Settings" upon completion.
 */

import {
  CLIENT_INSTANCE_ID_KEY,
  ProviderLocalSettings,
  SupportedProviderId,
  USER_SETTINGS_SCHEMA_VERSION,
  USER_SETTINGS_STORAGE_KEY,
  UserSettingsSchema,
} from '../../types/userSettings';

const ALL_PROVIDERS: SupportedProviderId[] = [
  'gemini',
  'groq',
  'openrouter',
  'mistral',
  'cohere',
  'huggingface',
  'openai',
  'custom_openai',
];

/**
 * Generate a cryptographically random UUID for this client browser profile.
 */
export function getOrCreateClientInstanceId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_INSTANCE_ID_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(CLIENT_INSTANCE_ID_KEY, newId);
    return newId;
  } catch {
    return `ephemeral_client_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Construct default provider settings.
 * Notice: All API keys start empty. No API keys are hardcoded.
 */
function createDefaultProviderMap(): Record<SupportedProviderId, ProviderLocalSettings> {
  const providers: Record<string, ProviderLocalSettings> = {};
  for (const pid of ALL_PROVIDERS) {
    providers[pid] = {
      apiKey: '',
      baseUrl: pid === 'custom_openai' ? '' : undefined,
      enabled: true,
      selectedModel: '',
      timeoutSeconds: 30,
    };
  }
  return providers as Record<SupportedProviderId, ProviderLocalSettings>;
}

/**
 * Produce the pristine default settings object.
 */
export function getDefaultUserSettings(instanceId?: string): UserSettingsSchema {
  const resolvedId = instanceId || getOrCreateClientInstanceId();
  return {
    version: USER_SETTINGS_SCHEMA_VERSION,
    clientInstanceId: resolvedId,
    updatedAt: new Date().toISOString(),
    providers: createDefaultProviderMap(),
    activeAI: {
      selectedProvider: 'gemini',
      selectedModel: 'gemini-3.8-flash',
      fallbackProviders: [],
      temperature: 0.2,
    },
    formatting: {
      preset: 'academic',
      citationStyle: 'apa',
      includePageNumbers: true,
      includeHeader: true,
      fontFamily: 'Times New Roman',
      fontSizePt: 11,
      lineSpacing: 1.15,
      marginInches: 1.0,
    },
    document: {
      autoCleanArtifacts: true,
      preserveMathEnvironments: true,
      defaultExportFormat: 'docx',
      autoAnalyzeOnChange: false,
    },
    ui: {
      themeMode: 'dark',
      previewZoomPercent: 100,
      compactControls: false,
      showDocumentStats: true,
      activeMobileTab: 'editor',
    },
    skills: {
      academicSynthesisEnabled: true,
      latexStandardizationEnabled: true,
      conversationalDenoisingEnabled: true,
      strictCitationFormatting: true,
    },
  };
}

/**
 * Migration helper from legacy localStorage keys if present.
 */
function migrateLegacyStorage(target: UserSettingsSchema): UserSettingsSchema {
  try {
    const legacyKey = 'formatai_provider_configs';
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData) {
      const parsed = JSON.parse(legacyData);
      if (parsed && typeof parsed === 'object') {
        for (const [key, val] of Object.entries(parsed)) {
          if (ALL_PROVIDERS.includes(key as SupportedProviderId)) {
            const v = val as Partial<ProviderLocalSettings>;
            target.providers[key as SupportedProviderId] = {
              apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
              baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : '',
              enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
              selectedModel: typeof v.selectedModel === 'string' ? v.selectedModel : '',
              timeoutSeconds: typeof v.timeoutSeconds === 'number' ? v.timeoutSeconds : 30,
            };
          }
        }
      }
    }
  } catch {
    // Non-fatal migration error
  }
  return target;
}

/**
 * Validate and safely sanitize loaded raw JSON.
 */
function sanitizeUserSettings(raw: unknown): UserSettingsSchema {
  const fallback = getDefaultUserSettings();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const obj = raw as Partial<UserSettingsSchema>;

  // Validate version
  const version = typeof obj.version === 'number' ? obj.version : fallback.version;
  const clientInstanceId =
    typeof obj.clientInstanceId === 'string' && obj.clientInstanceId.length > 0
      ? obj.clientInstanceId
      : fallback.clientInstanceId;

  // Validate providers
  const providers = createDefaultProviderMap();
  if (obj.providers && typeof obj.providers === 'object') {
    for (const pid of ALL_PROVIDERS) {
      const rawP = (obj.providers as Record<string, unknown>)[pid];
      if (rawP && typeof rawP === 'object') {
        const p = rawP as Partial<ProviderLocalSettings>;
        providers[pid] = {
          apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
          baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : pid === 'custom_openai' ? '' : undefined,
          enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
          selectedModel: typeof p.selectedModel === 'string' ? p.selectedModel : '',
          timeoutSeconds: typeof p.timeoutSeconds === 'number' && p.timeoutSeconds > 0 ? p.timeoutSeconds : 30,
        };
      }
    }
  }

  // Validate activeAI
  const activeAI = { ...fallback.activeAI };
  if (obj.activeAI && typeof obj.activeAI === 'object') {
    const rawAI = obj.activeAI as Partial<UserSettingsSchema['activeAI']>;
    if (rawAI.selectedProvider && ALL_PROVIDERS.includes(rawAI.selectedProvider)) {
      activeAI.selectedProvider = rawAI.selectedProvider;
    }
    if (typeof rawAI.selectedModel === 'string') {
      activeAI.selectedModel = rawAI.selectedModel;
    }
    if (Array.isArray(rawAI.fallbackProviders)) {
      activeAI.fallbackProviders = rawAI.fallbackProviders.filter((f) =>
        ALL_PROVIDERS.includes(f)
      );
    }
    if (typeof rawAI.temperature === 'number' && rawAI.temperature >= 0 && rawAI.temperature <= 1) {
      activeAI.temperature = rawAI.temperature;
    }
  }

  // Validate formatting
  const formatting = { ...fallback.formatting };
  if (obj.formatting && typeof obj.formatting === 'object') {
    const rawF = obj.formatting as Partial<UserSettingsSchema['formatting']>;
    if (rawF.preset && ['academic', 'research_paper', 'exam', 'study_notes', 'textbook'].includes(rawF.preset)) {
      formatting.preset = rawF.preset;
    }
    if (rawF.citationStyle && ['apa', 'ieee', 'mla', 'chicago', 'harvard'].includes(rawF.citationStyle)) {
      formatting.citationStyle = rawF.citationStyle;
    }
    if (typeof rawF.includePageNumbers === 'boolean') {
      formatting.includePageNumbers = rawF.includePageNumbers;
    }
    if (typeof rawF.includeHeader === 'boolean') {
      formatting.includeHeader = rawF.includeHeader;
    }
    if (typeof rawF.fontFamily === 'string') {
      formatting.fontFamily = rawF.fontFamily;
    }
    if (typeof rawF.fontSizePt === 'number' && rawF.fontSizePt >= 8 && rawF.fontSizePt <= 24) {
      formatting.fontSizePt = rawF.fontSizePt;
    }
    if (typeof rawF.lineSpacing === 'number' && rawF.lineSpacing >= 1.0 && rawF.lineSpacing <= 3.0) {
      formatting.lineSpacing = rawF.lineSpacing;
    }
    if (typeof rawF.marginInches === 'number' && rawF.marginInches >= 0.5 && rawF.marginInches <= 2.0) {
      formatting.marginInches = rawF.marginInches;
    }
  }

  // Validate document
  const document = { ...fallback.document };
  if (obj.document && typeof obj.document === 'object') {
    const rawD = obj.document as Partial<UserSettingsSchema['document']>;
    if (typeof rawD.autoCleanArtifacts === 'boolean') document.autoCleanArtifacts = rawD.autoCleanArtifacts;
    if (typeof rawD.preserveMathEnvironments === 'boolean') document.preserveMathEnvironments = rawD.preserveMathEnvironments;
    if (rawD.defaultExportFormat && ['docx', 'pdf'].includes(rawD.defaultExportFormat)) {
      document.defaultExportFormat = rawD.defaultExportFormat;
    }
    if (typeof rawD.autoAnalyzeOnChange === 'boolean') document.autoAnalyzeOnChange = rawD.autoAnalyzeOnChange;
  }

  // Validate UI
  const ui = { ...fallback.ui };
  if (obj.ui && typeof obj.ui === 'object') {
    const rawUI = obj.ui as Partial<UserSettingsSchema['ui']>;
    if (rawUI.themeMode && ['dark', 'light', 'system'].includes(rawUI.themeMode)) {
      ui.themeMode = rawUI.themeMode;
    }
    if (typeof rawUI.previewZoomPercent === 'number' && rawUI.previewZoomPercent >= 50 && rawUI.previewZoomPercent <= 200) {
      ui.previewZoomPercent = rawUI.previewZoomPercent;
    }
    if (typeof rawUI.compactControls === 'boolean') ui.compactControls = rawUI.compactControls;
    if (typeof rawUI.showDocumentStats === 'boolean') ui.showDocumentStats = rawUI.showDocumentStats;
    if (rawUI.activeMobileTab && ['editor', 'preview'].includes(rawUI.activeMobileTab)) {
      ui.activeMobileTab = rawUI.activeMobileTab;
    }
  }

  // Validate skills
  const skills = { ...fallback.skills };
  if (obj.skills && typeof obj.skills === 'object') {
    const rawS = obj.skills as Partial<UserSettingsSchema['skills']>;
    if (typeof rawS.academicSynthesisEnabled === 'boolean') skills.academicSynthesisEnabled = rawS.academicSynthesisEnabled;
    if (typeof rawS.latexStandardizationEnabled === 'boolean') skills.latexStandardizationEnabled = rawS.latexStandardizationEnabled;
    if (typeof rawS.conversationalDenoisingEnabled === 'boolean') skills.conversationalDenoisingEnabled = rawS.conversationalDenoisingEnabled;
    if (typeof rawS.strictCitationFormatting === 'boolean') skills.strictCitationFormatting = rawS.strictCitationFormatting;
  }

  return {
    version,
    clientInstanceId,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    providers,
    activeAI,
    formatting,
    document,
    ui,
    skills,
  };
}

/**
 * Load user settings from browser localStorage with safe sanitization.
 */
export function loadUserSettings(): UserSettingsSchema {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!raw) {
      // First run in this browser: build defaults and check for legacy settings to migrate
      const fresh = getDefaultUserSettings();
      const migrated = migrateLegacyStorage(fresh);
      saveUserSettings(migrated);
      return migrated;
    }
    const parsed = JSON.parse(raw);
    return sanitizeUserSettings(parsed);
  } catch (err) {
    console.warn('Failed to parse local user settings; reverting safely to defaults:', err);
    return getDefaultUserSettings();
  }
}

/**
 * Save user settings to browser localStorage.
 */
export function saveUserSettings(settings: UserSettingsSchema): boolean {
  try {
    const toSave: UserSettingsSchema = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
    return true;
  } catch (err) {
    console.error('Failed to write user settings to localStorage:', err);
    return false;
  }
}

/**
 * Atomic update utility for user settings.
 */
export function updateUserSettings(
  updater: (prev: UserSettingsSchema) => UserSettingsSchema
): UserSettingsSchema {
  const current = loadUserSettings();
  const next = updater(current);
  saveUserSettings(next);
  return next;
}

/**
 * Completely wipe all local settings, keys, and cached state from this browser.
 */
export function resetAllUserSettings(): UserSettingsSchema {
  try {
    localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
    localStorage.removeItem(CLIENT_INSTANCE_ID_KEY);
    localStorage.removeItem('formatai_provider_configs');
  } catch {
    // ignore
  }
  const fresh = getDefaultUserSettings();
  saveUserSettings(fresh);
  return fresh;
}

/**
 * Export current user settings as a client-side JSON download.
 * Does NOT contact the server.
 */
export function exportUserSettingsToFile(): void {
  const current = loadUserSettings();
  const jsonStr = JSON.stringify(current, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `formatai-settings-profile-${current.clientInstanceId.substring(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import user settings from an uploaded JSON string with schema sanitization.
 */
export function importUserSettingsFromJson(jsonString: string): UserSettingsSchema {
  const parsed = JSON.parse(jsonString);
  const sanitized = sanitizeUserSettings(parsed);
  saveUserSettings(sanitized);
  return sanitized;
}
