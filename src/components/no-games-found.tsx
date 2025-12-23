import React from "react";
import { Icon } from "@iconify/react";

export const NoGamesFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64 p-4">
      <Icon icon="lucide:package-x" className="text-muted-foreground mb-4" width={48} />
      <h3 className="text-xl font-semibold mb-1">No Epic Games Store games found</h3>
      <p className="text-muted-foreground text-center max-w-md">
        We couldn't find any Epic Games Store games installed on your system.
      </p>
      <p className="text-muted-foreground text-center max-w-md mt-2">
        Click "Scan for Games" to search for installed Epic Games.
      </p>
    </div>
  );
};
