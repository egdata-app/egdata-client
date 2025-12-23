import React from "react";
import { Icon } from "@iconify/react";
import { useSettings } from "../hooks/use-settings";
import { minimizeWindow, isTauri } from "../lib/tauri-commands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export const AppHeader: React.FC = () => {
  const { settings, isLoading, updateSettings } = useSettings();

  if (isLoading || !settings) {
    return <div className="h-14 flex items-center px-4 border-b border-border">Loading settings...</div>;
  }

  const handleEnvironmentChange = (env: string, checked: boolean) => {
    const current = settings.allowed_environments || [];
    const newEnvs = checked
      ? [...current, env]
      : current.filter((e: string) => e !== env);
    updateSettings({ allowed_environments: newEnvs });
  };

  const environments = ["Live", "Staging", "Production", "Development", "Testing"];

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <img
          src="https://cdn.egdata.app/logo_simple_white_clean.png"
          width={28}
          height={28}
          alt="EGData Logo"
        />
        <span className="font-semibold text-lg">EGData Scanner</span>
      </div>

      <div className="flex items-center gap-1">
        {isTauri() && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => minimizeWindow()}>
                <Icon icon="lucide:minimize-2" width={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Minimize</TooltipContent>
          </Tooltip>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Icon icon="lucide:settings" width={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:settings" width={18} />
                  <span className="font-semibold">Settings</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="concurrency">Concurrency</Label>
                  <p className="text-xs text-muted-foreground">Number of concurrent manifest uploads</p>
                  <Input
                    id="concurrency"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.concurrency}
                    onChange={(e) => updateSettings({ concurrency: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="speed-limit">Upload Speed Limit</Label>
                  <p className="text-xs text-muted-foreground">KB/s (0 = unlimited)</p>
                  <Input
                    id="speed-limit"
                    type="number"
                    min={0}
                    max={10000}
                    step={100}
                    value={settings.upload_speed_limit}
                    onChange={(e) => updateSettings({ upload_speed_limit: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="upload-interval">Upload Interval (minutes)</Label>
                  <p className="text-xs text-muted-foreground">How often to check for new games</p>
                  <Input
                    id="upload-interval"
                    type="number"
                    min={1}
                    max={10080}
                    value={settings.upload_interval}
                    onChange={(e) => updateSettings({ upload_interval: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="scan-interval">Scan Interval (minutes)</Label>
                  <p className="text-xs text-muted-foreground">How often to scan for game changes</p>
                  <Input
                    id="scan-interval"
                    type="number"
                    min={1}
                    max={60}
                    value={settings.scan_interval_minutes}
                    onChange={(e) => updateSettings({ scan_interval_minutes: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Allowed Environments</Label>
                  <p className="text-xs text-muted-foreground">Labels allowed to upload</p>
                  <div className="space-y-2 pt-1">
                    {environments.map((env) => (
                      <div key={env} className="flex items-center gap-2">
                        <Checkbox
                          id={`env-${env}`}
                          checked={settings.allowed_environments?.includes(env) || false}
                          onCheckedChange={(checked) => handleEnvironmentChange(env, checked as boolean)}
                        />
                        <Label htmlFor={`env-${env}`} className="text-sm font-normal cursor-pointer">
                          {env}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <p className="text-xs text-muted-foreground text-right">
                  Settings are saved automatically
                </p>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('https://github.com/egdata-app/egdata-client')}
            >
              <Icon icon="lucide:github" width={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>GitHub</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Icon icon="lucide:help-circle" width={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};
