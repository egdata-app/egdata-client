import React from 'react';
import {
  Button,
  Card,
  Divider,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Chip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Toaster, toast } from 'sonner';
import { GameScanner } from "./components/game-scanner";
import { GameListHeader } from "./components/game-list-header";
import { LogConsole } from "./components/log-console";
import { NoGamesFound } from "./components/no-games-found";
import { AppHeader } from "./components/app-header";
import { GameDetail } from "./components/game-detail";
import { useGameLibrary } from './hooks/use-scan-games';
import { useUploadManifest } from './hooks/use-upload-manifest';

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
    selectedGame,
    setSelectedGame,
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
    <div className="flex flex-col h-screen bg-content2 dark text-foreground overflow-hidden">
      <Toaster position="top-right" richColors className="z-[9999]" />
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 p-4 overflow-hidden">
          <GameScanner
            isScanning={isScanning}
            onScan={scanGames}
            scanProgress={scanProgress}
          />

          <Divider className="my-4" />

          <div className="flex-1 overflow-hidden flex flex-col">
            <GameListHeader
              gameCount={filteredGames.length}
              showConsole={showConsole}
              onToggleConsole={toggleConsole}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />

            <div className="flex-1 overflow-hidden mt-2">
              <Card className="h-full flex flex-col">
                {filteredGames.length > 0 ? (
                  <Table
                    removeWrapper
                    aria-label="Installed Epic Games"
                    selectionMode="single"
                    selectedKeys={selectedGame ? [selectedGame.id] : []}
                    onSelectionChange={(keys) => {
                      const selectedId = Array.from(keys)[0]?.toString();
                      const game = filteredGames.find(g => g.id === selectedId);
                      if (game) setSelectedGame(game as any);
                    }}
                    className="h-full"
                    isHeaderSticky
                    classNames={{
                      base: "max-h-[520px] overflow-y-scroll",
                      table: "min-h-[420px]",
                      tr: "h-12",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>GAME</TableColumn>
                      <TableColumn>SIZE</TableColumn>
                      <TableColumn>INSTALL PATH</TableColumn>
                      <TableColumn>VERSION</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody items={filteredGames} emptyContent={<NoGamesFound />}>
                      {(game: any) => (
                        <TableRow key={game.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <img
                                src={game.coverImage}
                                alt={game.name}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                              <div>
                                <div className="font-medium">{game.name}</div>
                                <div className="text-default-400 text-tiny">{game.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{game.size}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[200px]">{game.installPath}</span>
                              <Tooltip content="Copy Path">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onPress={() => navigator.clipboard.writeText(game.installPath)}
                                >
                                  <Icon icon="lucide:copy" className="text-default-500" width={14} />
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="sm"
                              variant="flat"
                              color="primary"
                            >
                              {game.version}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Tooltip content="Send manifest" delay={500}>
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  isLoading={uploadMutation.isPending && uploadMutation.variables?.gameId === game.id}
                                  onClick={() => uploadMutation.mutate({ gameId: game.id, installationGuid: game.installation_guid })}
                                  disabled={uploadMutation.isPending}
                                >
                                  <Icon icon="lucide:key" width={16} />
                                  <span>Send</span>
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : !isScanning ? (
                  <NoGamesFound />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner color="primary" />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>

        {selectedGame && (
          <Card className="w-72 h-full m-4 mr-0 shrink-0 overflow-auto">
            <GameDetail game={selectedGame} onClose={() => setSelectedGame(null)} />
          </Card>
        )}
      </div>

      {showConsole && <LogConsole logs={logs} onClear={clearLogs} />}
    </div>
  );
}