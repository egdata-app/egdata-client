import React from "react";
import { Card, CardHeader, CardBody, Button, Divider, cn } from "@heroui/react";
import { Icon } from "@iconify/react";

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
        .map(
          (log) =>
            `[${log.timestamp}] ${log.message}`
        )
        .join("\n")
    );
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <Card className="m-4 mt-0 h-64">
      <CardHeader className="flex justify-between">
        <h3 className="font-semibold">Console Output</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="light" isIconOnly onPress={handleCopy}>
            <Icon icon="lucide:copy" width={16} />
          </Button>
          <Button size="sm" variant="light" isIconOnly onPress={handleClear}>
            <Icon icon="lucide:trash" width={16} />
          </Button>
        </div>
      </CardHeader>
      <Divider />
      <CardBody>
        <div
          ref={logRef}
          className="font-mono text-xs h-full overflow-auto bg-content3 rounded-md p-2 flex flex-col-reverse"
        >
          {logs.map((log, index) => (
            <div
              key={index}
              className={cn(
                "py-0.5 inline-flex w-full gap-2",
                log.message.includes("ERROR")
                  ? "text-danger"
                  : log.message.includes("SUCCESS")
                    ? "text-success"
                    : ""
              )}
            >
              <span className="text-default-400">
                {log.timestamp}
              </span>
              {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-default-400 italic">No logs to display...</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};