import { invoke } from '@tauri-apps/api/core';

/**
 * Show the main application window
 */
export async function showWindow(): Promise<void> {
  return invoke('show_window');
}

/**
 * Hide the main application window
 */
export async function hideWindow(): Promise<void> {
  return invoke('hide_window');
}

/**
 * Minimize the main application window
 */
export async function minimizeWindow(): Promise<void> {
  return invoke('minimize_window');
}

/**
 * Clear all uploaded manifest records
 */
export async function clearUploadedManifests(): Promise<void> {
  return invoke('clear_uploaded_manifests');
}

/**
 * Check if the application is running in Tauri
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}