import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useSettings as useSettingsFromStore, settingsCollection } from '../lib/store';

export interface Settings {
  concurrency?: number;
  upload_speed_limit?: number;
  allowed_environments?: string[];
  upload_interval?: number; // in minutes
  scan_interval_minutes?: number; // in minutes
}

export function useSettings() {

  // Use TanStack DB for real-time settings
  const { data: settingsData = [] } = useSettingsFromStore();
  const settings = settingsData[0] || null;
  const isLoading = false; // TanStack DB provides instant access
  const isError = false; // Error handling is done in the store

  // Update settings with optimistic updates via TanStack DB
  const mutation = useMutation({
    mutationFn: async (newSettings: Settings) => {
      // Optimistically update the store first
      settingsCollection.update('current', (draft: any) => {
        Object.assign(draft, newSettings);
      });
      
      // Then sync to backend (this is handled by the collection's onUpdate)
      return newSettings;
    },
    onError: async () => {
      // On error, reload settings from backend to revert optimistic update
      try {
        const backendSettings = await invoke<Settings>('get_settings');
        settingsCollection.update('current', (draft: any) => {
          Object.assign(draft, backendSettings);
        });
      } catch (error) {
        console.error('Failed to revert settings:', error);
      }
    },
  });

  // updateSettings API for consumers with optimistic updates
  const updateSettings = (newSettings: Partial<Settings>) => {
    if (!settings) return;
    const updatedSettings = { ...settings, ...newSettings };
    mutation.mutate(updatedSettings);
  };

  return {
    settings,
    isLoading,
    isError,
    updateSettings,
    isUpdating: mutation.isPending,
  };
}
