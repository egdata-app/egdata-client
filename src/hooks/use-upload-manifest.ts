import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// Removed local tracking functionality - API handles duplicates

export function useUploadManifest() {
    return useMutation({
        mutationFn: async ({ gameId, installationGuid }: { gameId: string; installationGuid: string }) => {
            const result = await invoke('upload_manifest', { gameId, installationGuid });
            return result;
        },
    });
}