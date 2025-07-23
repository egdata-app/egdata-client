import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useLiveQuery } from '@tanstack/react-db';
import { logsCollection } from '../lib/store';

export interface BackendLogEvent {
  level: string;
  message: string;
  timestamp: string;
}

export function useBackendLogs(onLog?: (message: string) => void) {
  const handleLogEvent = useCallback((event: any) => {
    const logData = event.payload as BackendLogEvent;
    const formattedMessage = `[${logData.timestamp}] ${logData.level}: ${logData.message}`;
    
    // Add to TanStack DB store for real-time updates
    logsCollection.insert({
      id: `${Date.now()}-${Math.random()}`,
      level: logData.level,
      message: logData.message,
      timestamp: logData.timestamp,
      formattedMessage,
      createdAt: new Date().toISOString()
    });
    
    // Call the optional callback for backward compatibility
    if (onLog) {
      onLog(formattedMessage);
    }
  }, [onLog]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen('log-event', handleLogEvent);
      } catch (error) {
        console.error('Failed to setup backend log listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleLogEvent]);
}

// New hook to get logs from TanStack DB in real-time
export function useRealtimeLogs() {
  return useLiveQuery((q: any) => q.from({ log: logsCollection }));
}

// Hook to clear all logs
export function useClearLogs() {
  const logs = useRealtimeLogs();
  
  return useCallback(() => {
    // Clear logs by deleting each one
    if (logs && Array.isArray(logs)) {
      logs.forEach((log: any) => {
        logsCollection.delete(log.id);
      });
    }
  }, [logs]);
}