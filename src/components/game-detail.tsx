import React from "react";
import { Icon } from "@iconify/react";
import { toast } from 'sonner';
import { Game } from "../hooks/use-scan-games";
import { CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GameDetailProps {
  game: Game;
  onClose: () => void;
}

export const GameDetail: React.FC<GameDetailProps> = ({ game, onClose }) => {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <h3 className="font-semibold">Game Details</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <Icon icon="lucide:x" width={16} />
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="p-4">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <img
              src={game.coverImage || game.icon}
              alt={game.name}
              className="w-full aspect-[3/4] rounded-lg object-cover bg-muted"
            />
            <h3 className="font-semibold text-lg text-center">{game.name}</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">GAME ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm truncate flex-1 font-mono">{game.id}</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(game.id, 'Game ID')}
                    >
                      <Icon icon="lucide:copy" className="text-muted-foreground" width={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy ID</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">VERSION</p>
              <Badge variant="default" className="font-mono">{game.version}</Badge>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">SIZE</p>
              <p className="text-sm font-mono tabular-nums">{game.size}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">INSTALL PATH</p>
              <div className="flex items-start gap-1">
                <p className="text-sm break-all flex-1 font-mono">{game.installPath}</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(game.installPath, 'Install path')}
                    >
                      <Icon icon="lucide:copy" className="text-muted-foreground" width={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy Path</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">LAST UPDATED</p>
              <p className="text-sm">{game.lastUpdated}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button className="w-full">
              <Icon icon="lucide:key" width={18} />
              Copy Auth Token
            </Button>
            <Button variant="secondary" className="w-full">
              <Icon icon="lucide:folder-open" width={18} />
              Open Game Folder
            </Button>
          </div>
        </div>
      </CardContent>
    </>
  );
};
