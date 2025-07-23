import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useLiveQuery } from '@tanstack/react-db';
import { uploadedManifestsCollection } from '../lib/store';

// Helper functions using TanStack DB
export const isManifestUploaded = (manifestHash: string): boolean => {
    // This would need to be used within a component with the hook
    // For now, we'll provide a synchronous fallback
    try {
        // Fallback to localStorage for synchronous access
        const stored = localStorage.getItem('uploaded-manifests');
        const uploaded = stored ? new Set(JSON.parse(stored)) : new Set();
        return uploaded.has(manifestHash);
    } catch {
        return false;
    }
};

export const clearUploadedManifests = (): void => {
     // Clear from TanStack DB store by deleting each manifest
     // Note: This should be called from within a component that has access to the manifests data
     console.log('Clear uploaded manifests requested - should be handled in component with manifest data');
     
     // Also clear localStorage for backward compatibility
     try {
       localStorage.removeItem('uploaded-manifests');
     } catch (error) {
       console.error('Failed to clear uploaded manifests from localStorage:', error);
     }
   };

// Hook to get uploaded manifests in real-time
export function useUploadedManifests() {
    return useLiveQuery((q: any) => q.from({ manifest: uploadedManifestsCollection }));
}

// Hook to check if a specific manifest is uploaded
export function useIsManifestUploaded(manifestHash: string) {
    return useLiveQuery((q: any) => 
        q.from({ manifest: uploadedManifestsCollection })
         .where(({ manifest }: any) => manifest.hash === manifestHash)
    );
}

export function useUploadManifest() {
    return useMutation({
        mutationFn: async ({ gameId, installationGuid }: { gameId: string; installationGuid: string }) => {
            const result = await invoke('upload_manifest', { gameId, installationGuid });

            // If upload was successful, save to TanStack DB store
            if (result && typeof result === 'object' && 'status' in result) {
                const uploadResult = result as { status: string; manifest_hash?: string };
                if (uploadResult.status === 'uploaded' && uploadResult.manifest_hash) {
                    // Add to TanStack DB collection for real-time updates
                    uploadedManifestsCollection.insert({
                        id: uploadResult.manifest_hash,
                        hash: uploadResult.manifest_hash,
                        gameId,
                        installationGuid,
                        uploadedAt: new Date().toISOString(),
                        status: 'uploaded'
                    });
                    
                    // Also save to localStorage for backward compatibility
                    try {
                        const stored = localStorage.getItem('uploaded-manifests');
                        const uploaded = stored ? new Set(JSON.parse(stored)) : new Set();
                        uploaded.add(uploadResult.manifest_hash);
                        localStorage.setItem('uploaded-manifests', JSON.stringify([...uploaded]));
                    } catch (error) {
                        console.error('Failed to save to localStorage:', error);
                    }
                } else if (uploadResult.status === 'already_uploaded' && uploadResult.manifest_hash) {
                    // Mark as already uploaded
                    uploadedManifestsCollection.insert({
                        id: uploadResult.manifest_hash,
                        hash: uploadResult.manifest_hash,
                        gameId,
                        installationGuid,
                        uploadedAt: new Date().toISOString(),
                        status: 'already_uploaded'
                    });
                }
            }

            return result;
        },
    });
}