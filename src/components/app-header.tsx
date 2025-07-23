import React from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  Button,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  CheckboxGroup,
  Checkbox,
  NumberInput
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useSettings } from "../hooks/use-settings";
import { minimizeWindow, isTauri, clearUploadedManifests as clearUploadedManifestsBackend } from "../lib/tauri-commands";
import { clearUploadedManifests as clearUploadedManifestsLocal } from "../hooks/use-upload-manifest";

export const AppHeader: React.FC = () => {
  const { settings, isLoading, updateSettings } = useSettings();

  const handleClearUploadedManifests = async () => {
    try {
      // Clear backend data
      await clearUploadedManifestsBackend();
      // Clear localStorage data
      clearUploadedManifestsLocal();
      // Optionally show a success message or refresh the UI
    } catch (error) {
      console.error('Failed to clear uploaded manifests:', error);
    }
  };

  if (isLoading || !settings) {
    // You can return a spinner, skeleton, or null
    return <div className="h-16 flex items-center px-4">Loading settings...</div>;
  }

  return (
    <Navbar maxWidth="full" isBordered>
      <NavbarBrand>
        <img src="https://cdn.egdata.app/logo_simple_white_clean.png"
          width={28}
          height={28}
        />
        <p className="font-bold text-inherit ml-2">Games Scanner</p>
      </NavbarBrand>
      <NavbarContent justify="end">
        {isTauri() && (
          <Tooltip content="Minimize">
            <Button
              isIconOnly
              variant="light"
              onPress={() => minimizeWindow()}
            >
              <Icon icon="lucide:minimize-2" width={20} />
            </Button>
          </Tooltip>
        )}

        <Popover placement="bottom-end">
          <PopoverTrigger>
            <Button isIconOnly variant="light">
              <Icon icon="lucide:settings" width={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 dark">
            <div className="px-1 py-2 w-full max-h-96 overflow-auto">
              <div className="flex items-center gap-2 mb-2 text-white">
                <Icon icon="lucide:settings" width={18} />
                <span className="text-medium font-semibold">Settings</span>
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Concurrency</div>
                <div className="mb-1 text-xs text-default-400">Number of concurrent manifest uploads</div>
                <NumberInput
                  size="sm"
                  value={settings.concurrency}
                  onValueChange={(value) => updateSettings({ concurrency: value })}
                  minValue={1}
                  maxValue={10}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Upload Speed Limit</div>
                <div className="mb-1 text-xs text-default-400">KB/s (0 = unlimited)</div>
                <NumberInput
                  size="sm"
                  value={settings.upload_speed_limit}
                  onValueChange={(value) => updateSettings({ upload_speed_limit: value })}
                  minValue={0}
                  maxValue={10000}
                  step={100}
                  className="w-full"
                />
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Upload Interval (hours)</div>
                <div className="mb-1 text-xs text-default-400">How often to check for new games (in hours)</div>
                <NumberInput
                  size="sm"
                  value={settings.upload_interval}
                  onValueChange={(value) => updateSettings({ upload_interval: value })}
                  minValue={1}
                  maxValue={168}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Scan Interval (minutes)</div>
                <div className="mb-1 text-xs text-default-400">How often to scan for game changes (in minutes)</div>
                <NumberInput
                  size="sm"
                  value={settings.scan_interval_minutes}
                  onValueChange={(value) => updateSettings({ scan_interval_minutes: value })}
                  minValue={1}
                  maxValue={60}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Allowed Environments</div>
                <div className="mb-2 text-xs text-default-400">Labels allowed to upload</div>
                <CheckboxGroup
                  value={settings.allowed_environments}
                  onValueChange={(values) => updateSettings({ allowed_environments: values })}
                  orientation="vertical"
                  color="primary"
                >
                  <Checkbox value="Live">Live</Checkbox>
                  <Checkbox value="Staging">Staging</Checkbox>
                  <Checkbox value="Production">Production</Checkbox>
                  <Checkbox value="Development">Development</Checkbox>
                  <Checkbox value="Testing">Testing</Checkbox>
                </CheckboxGroup>
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="py-1">
                <div className="text-sm text-default-600 mb-1">Upload History</div>
                <div className="mb-2 text-xs text-default-400">Clear uploaded manifest records to re-upload games</div>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  onPress={handleClearUploadedManifests}
                  className="w-full"
                  startContent={<Icon icon="lucide:trash-2" width={16} />}
                >
                  Clear Upload History
                </Button>
              </div>

              <div className="h-px bg-default-100 my-2" />

              <div className="flex justify-end py-1">
                <span className="text-tiny text-default-400">Settings are saved automatically</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Tooltip content="GitHub">
          <Button isIconOnly variant="light" onPress={() => {
            window.open('https://github.com/egdata/egdata-client');
          }}>
            <Icon icon="lucide:github" width={20} />
          </Button>
        </Tooltip>
        <Tooltip content="Help">
          <Button isIconOnly variant="light">
            <Icon icon="lucide:help-circle" width={20} />
          </Button>
        </Tooltip>
      </NavbarContent>
    </Navbar>
  );
};