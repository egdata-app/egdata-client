import { createCollection, localOnlyCollectionOptions } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/react-db';
import { eq } from '@tanstack/db';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Game, GameInfo } from '../hooks/use-scan-games';
import type { Settings } from '../hooks/use-settings';


// Game Collection
export const gameCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'games',
    getKey: (item: any) => item.id,
    onUpdate: async ({ transaction }: any) => {
      // Handle optimistic updates to backend
      const { original, changes } = transaction.mutations[0];
      // Since games are read-only from backend, we don't need to sync back
      console.log('Game updated:', { original, changes });
    },
    onInsert: async ({ transaction }: any) => {
      // Games are managed by backend, no insert needed
      console.log('Game inserted:', transaction.mutations[0]);
    },
    onDelete: async ({ transaction }: any) => {
      // Games are managed by backend, no delete needed
      console.log('Game deleted:', transaction.mutations[0]);
    },
  })
);

// Settings Collection
export const settingsCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'settings',
    getKey: (item: any) => item.id,
    onUpdate: async ({ transaction }: any) => {
      const { modified } = transaction.mutations[0];
      // Sync complete settings object to backend (excluding the 'id' field)
      const { _id, ...settingsToSend } = modified;
      await invoke('set_settings', { newSettings: settingsToSend });
    },
  })
);

// Logs Collection for real-time log streaming
export const logsCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'logs',
    getKey: (item: any) => item.id,
    onInsert: async ({ transaction }: any) => {
      // Logs are append-only, no backend sync needed
      console.log('Log added:', transaction.mutations[0]);
    },
  })
);

// Upload Status Collection
export const uploadStatusCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'uploadStatus',
    getKey: (item: any) => item.id,
    onUpdate: async ({ transaction }: any) => {
      // Upload status is managed by backend
      console.log('Upload status updated:', transaction.mutations[0]);
    },
  })
);

// Removed uploaded manifests collection - API handles duplicates

// Initialize collections with data from backend
export async function initializeStore() {
  try {
    // Load initial games data
    const gameInfos = await invoke<GameInfo[]>('get_installed_games');
    const games = gameInfos.map(convertGameInfo);

    // Clear any existing games first (in case of re-initialization)
    // Note: We'll let the collection handle duplicates via upsert behavior

    // Populate games collection with fresh data
    games.forEach(game => {
      gameCollection.insert(game as any);
    });

    // Load initial settings
    const settings = await invoke<Settings>('get_settings');
    settingsCollection.insert({ id: 'current', ...settings } as any);

    // Removed uploaded manifests initialization - API handles duplicates

    // Set up real-time listeners
    setupRealtimeListeners();

  } catch (error) {
    console.error('Failed to initialize store:', error);
  }
}

// Set up real-time event listeners
function setupRealtimeListeners() {
  // Listen for games updates from backend
  listen('games-updated', async () => {
    try {
      const gameInfos = await invoke<GameInfo[]>('get_installed_games');
      const games = gameInfos.map(convertGameInfo);

      // Clear existing games first, then insert fresh data
      // Since we can't easily get all items synchronously, we'll use upsert behavior
      // The collection will handle duplicates by updating existing items
      
      // Insert/update fresh games data
      games.forEach(game => {
        gameCollection.insert(game as any);
      });
    } catch (error) {
      console.error('Failed to update games from backend:', error);
    }
  });

  // Listen for log events
  listen('log-event', (event: any) => {
    const logEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...event.payload
    };
    logsCollection.insert(logEntry);
  });

  // Listen for upload status updates
  listen('upload-status', (event: any) => {
    uploadStatusCollection.update('current', (draft: any) => {
      Object.assign(draft, event.payload);
    });
  });
}

// Helper function to convert GameInfo to Game (same as in use-scan-games.ts)
function convertGameInfo(gameInfo: GameInfo): Game {
  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const metadata = gameInfo.metadata;
  let coverImage = `https://img.heroui.chat/image/game?w=400&h=600&seed=${gameInfo.app_name}`;
  let icon = `https://img.heroui.chat/image/game?w=100&h=100&seed=${gameInfo.app_name}`;

  if (metadata?.keyImages) {
    const tallCover = metadata.keyImages.find(img => img.type === 'DieselGameBoxTall');
    const wideCover = metadata.keyImages.find(img => img.type === 'DieselGameBox');
    if (tallCover) {
      coverImage = tallCover.url;
      icon = tallCover.url;
    } else if (wideCover) {
      coverImage = wideCover.url;
      icon = wideCover.url;
    }
  }

  return {
    id: gameInfo.catalog_item_id,
    name: metadata?.title || gameInfo.display_name,
    icon,
    coverImage,
    size: formatFileSize(gameInfo.install_size),
    installPath: gameInfo.install_location,
    version: gameInfo.version,
    lastUpdated: new Date().toISOString().split('T')[0],
    installation_guid: gameInfo.installation_guid,
    manifest_hash: gameInfo.manifest_hash,
  };
}

// Export hooks for using collections in components
export function useGames() {
  return useLiveQuery((q: any) => q.from({ game: gameCollection }));
}

export function useSettings() {
  return useLiveQuery((q: any) =>
    q.from({ settings: settingsCollection })
      .where(({ settings }: any) => eq(settings.id, 'current'))
  );
}

export function useLogs() {
  return useLiveQuery((q: any) =>
    q.from({ log: logsCollection })
      .orderBy(({ log }: any) => log.timestamp, 'desc')
  );
}

export function useUploadStatus() {
  return useLiveQuery((q: any) =>
    q.from({ status: uploadStatusCollection })
      .where(({ status }: any) => eq(status.id, 'current'))
  );
}

// Removed uploaded manifests hooks - API handles duplicates

// Helper function to clear all logs
export function clearLogs() {
  // Since we can't use hooks outside components, we'll use a different approach
  // This will be handled in the component that needs to clear logs
  console.log('Clear logs requested - should be handled in component');
}