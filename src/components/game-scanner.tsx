import React from "react";
import {
  Button,
  Card,
  Progress,
  Badge
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';

interface GameScannerProps {
  isScanning: boolean;
  scanProgress: number;
  onScan: () => void;
}

export const GameScanner: React.FC<GameScannerProps> = ({
  isScanning,
  scanProgress,
  onScan
}) => {
  const uploadAllMutation = useMutation({
    mutationFn: async () => {
      return await invoke('upload_all_manifests');
    },
  });

  // Listen for periodic upload completion events
  React.useEffect(() => {
    const unlisten = listen('periodic-upload-completed', (event) => {
      const results = event.payload as any[];
      const uploadedCount = results.filter(r => r.status === 'uploaded').length;
      const alreadyUploadedCount = results.filter(r => r.status === 'already_uploaded').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      if (uploadedCount > 0) {
        toast.success(`Periodic upload completed: ${uploadedCount} uploaded, ${alreadyUploadedCount} already uploaded, ${failedCount} failed`);
      } else if (failedCount > 0) {
        toast.error(`Periodic upload failed: ${failedCount} failed`);
      } else {
        toast.info(`Periodic upload completed: ${alreadyUploadedCount} already uploaded`);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Handle upload all mutation results
  React.useEffect(() => {
    if (uploadAllMutation.isSuccess) {
      const results = uploadAllMutation.data as any[];
      const uploadedCount = results.filter(r => r.status === 'uploaded').length;
      const alreadyUploadedCount = results.filter(r => r.status === 'already_uploaded').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      if (uploadedCount > 0) {
        toast.success(`Upload completed: ${uploadedCount} uploaded, ${alreadyUploadedCount} already uploaded, ${failedCount} failed`);
      } else if (failedCount > 0) {
        toast.error(`Upload failed: ${failedCount} failed`);
      } else {
        toast.info(`Upload completed: ${alreadyUploadedCount} already uploaded`);
      }
    } else if (uploadAllMutation.isError) {
      toast.error('Upload all failed');
    }
  }, [uploadAllMutation.isSuccess, uploadAllMutation.isError, uploadAllMutation.data]);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Epic Games Scanner</h2>
          <p className="text-default-500 text-sm">
            Scan your computer for installed Epic Games and extract game information
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isScanning ? (
            <Badge color="primary" content={`${Math.round(scanProgress)}%`}>
              <Button
                color="danger"
                variant="flat"
                startContent={<Icon icon="lucide:x" width={16} />}
              >
                Cancel Scan
              </Button>
            </Badge>
          ) : (
            <div className="flex gap-2">
              <Button
                color="secondary"
                variant="flat"
                onClick={() => uploadAllMutation.mutate()}
                isLoading={uploadAllMutation.isPending}
              >
                <Icon icon="lucide:upload" width={16} />
                Upload All
              </Button>
              <Button
                color="primary"
                startContent={<Icon icon="lucide:search" width={16} />}
                onPress={onScan}
              >
                Scan for Games
              </Button>
            </div>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="mt-4">
          <Progress
            value={scanProgress}
            color="primary"
            showValueLabel={true}
            className="w-full"
          />
          <p className="text-default-500 text-xs mt-1">
            Scanning system for Epic Games Store installations...
          </p>
        </div>
      )}
    </Card>
  );
};