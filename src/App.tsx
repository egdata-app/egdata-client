import React from 'react';
import { Icon } from "@iconify/react";
import { Toaster, toast } from 'sonner';
import { GameScanner } from "./components/game-scanner";
import { GameListHeader } from "./components/game-list-header";
import { LogConsole } from "./components/log-console";
import { NoGamesFound } from "./components/no-games-found";
import { AppHeader } from "./components/app-header";
import { useGameLibrary } from './hooks/use-scan-games';
import { useUploadManifest } from './hooks/use-upload-manifest';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function maybeParseJson(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function App() {
  const {
    games,
    isScanning,
    logs,
    scanGames,
    showConsole,
    toggleConsole,
    scanProgress,
    clearLogs
  } = useGameLibrary();
  const uploadMutation = useUploadManifest();
  const [searchTerm, setSearchTerm] = React.useState('');

  // Fuzzy search function
  const fuzzySearch = (text: string, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const target = text.toLowerCase();

    // Direct substring match
    if (target.includes(search)) return true;

    // Fuzzy match - check if all characters in search term appear in order
    let searchIndex = 0;
    for (let i = 0; i < target.length && searchIndex < search.length; i++) {
      if (target[i] === search[searchIndex]) {
        searchIndex++;
      }
    }
    return searchIndex === search.length;
  };

  // Filter games based on search term
  const filteredGames = React.useMemo(() => {
    if (!searchTerm.trim()) return games;

    return games.filter(game =>
      fuzzySearch(game.name, searchTerm) ||
      fuzzySearch(game.id, searchTerm) ||
      fuzzySearch(game.installPath, searchTerm)
    );
  }, [games, searchTerm]);

  React.useEffect(() => {
    if (uploadMutation.isSuccess) {
      const result = uploadMutation.data as any;
      if (result?.status === 'uploaded') {
        toast.success('Manifest uploaded successfully!');
      } else if (result?.status === 'already_uploaded') {
        toast.info(result?.message || 'Manifest already uploaded');
      } else if (result?.status === 'failed') {
        const parsed = maybeParseJson(result?.message || '');
        if (parsed && parsed.error) {
          toast.error(parsed.error);
        } else {
          toast.error('Upload failed.');
        }
      }
    } else if (uploadMutation.isError) {
      toast.error('Upload failed');
    }
  }, [uploadMutation.isSuccess, uploadMutation.isError, uploadMutation.data]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toaster position="top-right" richColors className="z-[9999]" />
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 p-4 overflow-hidden">
          <GameScanner
            isScanning={isScanning}
            onScan={scanGames}
            scanProgress={scanProgress}
          />

          <Separator className="my-4" />

          <div className="flex-1 overflow-hidden flex flex-col">
            <GameListHeader
              gameCount={filteredGames.length}
              showConsole={showConsole}
              onToggleConsole={toggleConsole}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />

            <div className="flex-1 overflow-hidden mt-2">
              <Card className="h-full flex flex-col border-border/50">
                {filteredGames.length > 0 ? (
                  <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                      {filteredGames.map((game: any) => (
                        <div
                          key={game.id}
                          className={cn(
                            "flex items-center gap-4 p-3 transition-colors hover:bg-accent/50"
                          )}
                        >
                          {/* Game Info */}
                          <div className="flex items-center gap-3 min-w-[280px]">
                            <img
                              src={game.coverImage}
                              alt={game.name}
                              className="w-10 h-10 rounded-md object-cover bg-muted"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{game.name}</div>
                              <div className="text-muted-foreground text-xs truncate font-mono">{game.id}</div>
                            </div>
                          </div>

                          {/* Size */}
                          <div className="w-20 text-sm text-muted-foreground font-mono tabular-nums">
                            {game.size}
                          </div>

                          {/* Install Path */}
                          <div className="flex-1 flex items-center gap-1 min-w-0">
                            <span className="text-sm text-muted-foreground truncate max-w-[200px] font-mono">
                              {game.installPath}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(game.installPath);
                                    toast.success('Path copied to clipboard');
                                  }}
                                >
                                  <Icon icon="lucide:copy" className="text-muted-foreground" width={14} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy Path</TooltipContent>
                            </Tooltip>
                          </div>

                          {/* Version */}
                          <Badge variant="secondary" className="shrink-0 font-mono">
                            {game.version}
                          </Badge>

                          {/* Actions */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="default"
                                className="shrink-0"
                                disabled={uploadMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  uploadMutation.mutate({ gameId: game.id, installationGuid: game.installation_guid });
                                }}
                              >
                                {uploadMutation.isPending && uploadMutation.variables?.gameId === game.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Icon icon="lucide:upload" width={16} />
                                )}
                                <span>Send</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send manifest to EGData</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : !isScanning ? (
                  <NoGamesFound />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {showConsole && <LogConsole logs={logs} onClear={clearLogs} />}
    </div>
  );
}
