import React from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GameListHeaderProps {
  gameCount: number;
  showConsole: boolean;
  onToggleConsole: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const GameListHeader: React.FC<GameListHeaderProps> = ({
  gameCount,
  showConsole,
  onToggleConsole,
  searchTerm,
  onSearchChange
}) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Installed Games</h2>
        <Badge variant="secondary">{gameCount}</Badge>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
            className="pl-8 h-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="console-toggle" className="text-sm text-muted-foreground cursor-pointer">
            Console
          </Label>
          <Switch
            id="console-toggle"
            checked={showConsole}
            onCheckedChange={onToggleConsole}
          />
        </div>
      </div>
    </div>
  );
};
