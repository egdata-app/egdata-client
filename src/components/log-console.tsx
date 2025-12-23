import React from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from 'sonner';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LogEntry {
  message: string;
  timestamp: string;
}

interface LogConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs, onClear }) => {
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      logs
        .map((log) => `[${log.timestamp}] ${log.message}`)
        .join("\n")
    );
    toast.success('Logs copied to clipboard');
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <Card className="m-4 mt-0 h-64 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <h3 className="font-semibold text-sm">Console Output</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-2">
        <ScrollArea className="h-[180px]">
          <div
            ref={logRef}
            className="font-mono text-xs bg-muted/50 rounded-md p-2 min-h-full"
          >
            {logs.length === 0 ? (
              <div className="text-muted-foreground italic">No logs to display...</div>
            ) : (
              <div className="flex flex-col-reverse">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      "py-0.5 inline-flex w-full gap-2",
                      log.message.includes("ERROR") && "text-destructive",
                      log.message.includes("SUCCESS") && "text-success"
                    )}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {log.timestamp}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
