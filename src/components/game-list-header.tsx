import React from "react";
import { Badge, Switch, Input } from "@heroui/react";
import { Icon } from "@iconify/react";

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
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Installed Games</h2>
        <Badge content={gameCount} size="md">
          {" "}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Input
          classNames={{
            base: "max-w-[200px]",
            inputWrapper: "h-9"
          }}
          placeholder="Search games..."
          startContent={<Icon icon="lucide:search" className="text-default-400" width={16} />}
          value={searchTerm}
          onValueChange={onSearchChange}
        />

        <div className="flex items-center gap-2">
          <span className="text-default-500 text-sm">Console</span>
          <Switch
            size="sm"
            isSelected={showConsole}
            onValueChange={onToggleConsole}
            color="primary"
          />
        </div>
      </div>
    </div>
  );
};