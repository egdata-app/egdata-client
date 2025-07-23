import React from "react";
import {
  CardHeader,
  CardBody,
  Button,
  Divider,
  Chip,
  Tooltip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Game } from "../hooks/use-scan-games";

interface GameDetailProps {
  game: Game;
  onClose: () => void;
}

export const GameDetail: React.FC<GameDetailProps> = ({ game, onClose }) => {
  return (
    <>
      <CardHeader className="flex justify-between">
        <h3 className="font-semibold">Game Details</h3>
        <Button isIconOnly size="sm" variant="light" onPress={onClose}>
          <Icon icon="lucide:x" width={16} />
        </Button>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <img
              src={game.coverImage || game.icon}
              alt={game.name}
              className="w-full aspect-[3/4] rounded-lg object-cover"
            />
            <h3 className="font-semibold text-lg">{game.name}</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-tiny text-default-400 mb-1">GAME ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm truncate">{game.id}</p>
                <Tooltip content="Copy ID">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => navigator.clipboard.writeText(game.id)}
                  >
                    <Icon icon="lucide:copy" className="text-default-500" width={14} />
                  </Button>
                </Tooltip>
              </div>
            </div>

            <div>
              <p className="text-tiny text-default-400 mb-1">VERSION</p>
              <Chip size="sm" variant="flat" color="primary">{game.version}</Chip>
            </div>

            <div>
              <p className="text-tiny text-default-400 mb-1">SIZE</p>
              <p className="text-sm">{game.size}</p>
            </div>

            <div>
              <p className="text-tiny text-default-400 mb-1">INSTALL PATH</p>
              <div className="flex items-center gap-1">
                <p className="text-sm break-all">{game.installPath}</p>
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
            </div>

            <div>
              <p className="text-tiny text-default-400 mb-1">LAST UPDATED</p>
              <p className="text-sm">{game.lastUpdated}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              fullWidth
              color="primary"
              startContent={<Icon icon="lucide:key" width={18} />}
            >
              Copy Auth Token
            </Button>
            <Button
              fullWidth
              variant="flat"
              startContent={<Icon icon="lucide:folder-open" width={18} />}
            >
              Open Game Folder
            </Button>
          </div>
        </div>
      </CardBody>
    </>
  );
};