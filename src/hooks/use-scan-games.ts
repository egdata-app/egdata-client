import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import React, { useCallback } from 'react';
import { useGames, useLogs, gameCollection, logsCollection } from '../lib/store';
import { useBackendLogs } from './use-backend-logs';

export interface Game {
  id: string;
  name: string;
  icon: string;
  coverImage?: string;
  size: string;
  installPath: string;
  version: string;
  lastUpdated: string;
  installation_guid: string;
  manifest_hash: string;
}

export interface GameInfo {
  display_name: string;
  app_name: string;
  install_location: string;
  install_size: number;
  version: string;
  catalog_namespace: string;
  catalog_item_id: string;
  metadata?: GameMetadata;
  installation_guid: string;
  manifest_hash: string;
}

export interface KeyImage {
  type: string;
  url: string;
  md5: string;
}

export interface GameMetadata {
  id: string;
  title: string;
  description: string;
  keyImages: KeyImage[];
  developer?: string;
  developerId?: string;
}

export interface LogEntry {
  message: string;
  timestamp: string;
}

export function useScanGames() {
  const [selectedGame, setSelectedGame] = React.useState<Game | null>(null);
  const [showConsole, setShowConsole] = React.useState(false);

  // Add scanProgress state
  const [scanProgress, setScanProgress] = React.useState(0);

  // Use TanStack DB for real-time games data
  const { data: games = [] } = useGames();

  // Use TanStack DB for real-time logs
  const { data: logsData = [] } = useLogs();
  const logs: LogEntry[] = logsData.map((log: any) => ({
    message: `[${log.level}] ${log.message}`,
    timestamp: log.timestamp || new Date().toISOString(),
  }));

  const addLog = React.useCallback((message: string) => {
    // Logs are now handled by TanStack DB store automatically
    // If you want to add a log with timestamp, you can do so here
    const logEntry = {
      message,
      timestamp: new Date().toISOString(),
    };
    // If logsCollection.insert supports custom fields, use:
    logsCollection.insert(logEntry as any);
    console.log('Log added via store:', logEntry);
  }, []);

  const clearLogs = useCallback(() => {
    // Clear logs by getting current logs and deleting each one
    const currentLogs = logsData;
    currentLogs.forEach((log: any) => {
      logsCollection.delete(log.id);
    });
  }, [logsData]);

  // Listen for backend log events (still needed for compatibility)
  useBackendLogs(addLog);

  const toggleConsole = () => setShowConsole(prev => !prev);

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const convertGameInfo = (gameInfo: GameInfo): Game => {
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
  };

  // Games are now loaded via TanStack DB store
  const isLoading = false; // TanStack DB provides instant access
  const isError = false; // Error handling is done in the store

  const refetch = React.useCallback(async () => {
    try {
      const gameInfos = await invoke<GameInfo[]>('get_installed_games');
      const convertedGames = gameInfos.map(convertGameInfo);

      // Clear existing games first by deleting all current games
      games.forEach(game => {
        gameCollection.delete(game.id);
      });

      // Insert fresh games data
      convertedGames.forEach(game => {
        gameCollection.insert(game as any);
      });
    } catch (error) {
      console.error('Failed to refetch games:', error);
    }
  }, [games]);

  // Scan games with progress simulation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setScanProgress(0);
      const start = Date.now();
      let progress = 0;
      const duration = 3_000; // 3 seconds
      const interval = setInterval(() => {
        progress = Math.min(100, ((Date.now() - start) / duration) * 100);
        setScanProgress(progress);
      }, 100);
      const result = await invoke<GameInfo[]>('scan_games_now');
      const elapsed = Date.now() - start;
      if (elapsed < duration) {
        await new Promise(res => setTimeout(res, duration - elapsed));
      }
      clearInterval(interval);
      setScanProgress(100);
      return result;
    },
    onSuccess: async () => {
      // Refresh games data in TanStack DB store
      await refetch();
      setTimeout(() => setScanProgress(0), 500);
    },
  });

  // games are now provided directly from TanStack DB

  return {
    games,
    isLoading,
    isError,
    refetch,
    scanGames: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    scanProgress,
    logs,
    addLog,
    clearLogs,
    selectedGame,
    setSelectedGame,
    showConsole,
    toggleConsole,
  };
}

// Export alias for backward compatibility
export const useGameLibrary = useScanGames;
