import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ActiveAISettings,
  DocumentPreferences,
  FormattingPreferences,
  ProviderLocalSettings,
  SkillPreferences,
  SupportedProviderId,
  UIPreferences,
  UserSettingsSchema,
} from '../types/userSettings';
import {
  exportUserSettingsToFile,
  getDefaultUserSettings,
  importUserSettingsFromJson,
  loadUserSettings,
  resetAllUserSettings,
  saveUserSettings,
} from '../services/storage/userSettingsStorage';

interface UserSettingsContextValue {
  settings: UserSettingsSchema;
  isLoaded: boolean;
  updateSettings: (updater: (prev: UserSettingsSchema) => UserSettingsSchema) => void;
  updateProviderSettings: (providerId: SupportedProviderId, updates: Partial<ProviderLocalSettings>) => void;
  updateActiveAI: (updates: Partial<ActiveAISettings>) => void;
  updateFormatting: (updates: Partial<FormattingPreferences>) => void;
  updateDocument: (updates: Partial<DocumentPreferences>) => void;
  updateUI: (updates: Partial<UIPreferences>) => void;
  updateSkills: (updates: Partial<SkillPreferences>) => void;
  resetSettings: () => void;
  exportSettings: () => void;
  importSettings: (jsonString: string) => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettingsSchema>(getDefaultUserSettings());
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from client-local storage on mount
  useEffect(() => {
    const loaded = loadUserSettings();
    setSettings(loaded);
    setIsLoaded(true);
  }, []);

  const updateSettings = useCallback((updater: (prev: UserSettingsSchema) => UserSettingsSchema) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveUserSettings(next);
      return next;
    });
  }, []);

  const updateProviderSettings = useCallback(
    (providerId: SupportedProviderId, updates: Partial<ProviderLocalSettings>) => {
      updateSettings((prev) => {
        const currentP = prev.providers[providerId] || {
          apiKey: '',
          baseUrl: providerId === 'custom_openai' ? '' : undefined,
          enabled: true,
          selectedModel: '',
          timeoutSeconds: 30,
        };
        return {
          ...prev,
          providers: {
            ...prev.providers,
            [providerId]: {
              ...currentP,
              ...updates,
            },
          },
        };
      });
    },
    [updateSettings]
  );

  const updateActiveAI = useCallback(
    (updates: Partial<ActiveAISettings>) => {
      updateSettings((prev) => ({
        ...prev,
        activeAI: {
          ...prev.activeAI,
          ...updates,
        },
      }));
    },
    [updateSettings]
  );

  const updateFormatting = useCallback(
    (updates: Partial<FormattingPreferences>) => {
      updateSettings((prev) => ({
        ...prev,
        formatting: {
          ...prev.formatting,
          ...updates,
        },
      }));
    },
    [updateSettings]
  );

  const updateDocument = useCallback(
    (updates: Partial<DocumentPreferences>) => {
      updateSettings((prev) => ({
        ...prev,
        document: {
          ...prev.document,
          ...updates,
        },
      }));
    },
    [updateSettings]
  );

  const updateUI = useCallback(
    (updates: Partial<UIPreferences>) => {
      updateSettings((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          ...updates,
        },
      }));
    },
    [updateSettings]
  );

  const updateSkills = useCallback(
    (updates: Partial<SkillPreferences>) => {
      updateSettings((prev) => ({
        ...prev,
        skills: {
          ...prev.skills,
          ...updates,
        },
      }));
    },
    [updateSettings]
  );

  const resetSettings = useCallback(() => {
    const fresh = resetAllUserSettings();
    setSettings(fresh);
  }, []);

  const exportSettings = useCallback(() => {
    exportUserSettingsToFile();
  }, []);

  const importSettings = useCallback((jsonString: string) => {
    const imported = importUserSettingsFromJson(jsonString);
    setSettings(imported);
  }, []);

  const value: UserSettingsContextValue = {
    settings,
    isLoaded,
    updateSettings,
    updateProviderSettings,
    updateActiveAI,
    updateFormatting,
    updateDocument,
    updateUI,
    updateSkills,
    resetSettings,
    exportSettings,
    importSettings,
  };

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
};

export function useUserSettings(): UserSettingsContextValue {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return ctx;
}
