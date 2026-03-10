"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Droplets, Lightbulb, Settings, Waves } from "lucide-react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Device = {
  id: string;
  name: string;
  status: string;
  lastSeenAt: string | null;
  configVersion: number;
  localConfigVersion: number;
  configSyncState: "pending" | "success" | "device";
  desiredConfig: Record<string, unknown>;
};

type Telemetry = {
  id: string;
  deviceId: string;
  tempC: number | null;
  humidity: number | null;
  flowMl: number | null;
  lampOn: boolean | null;
  pumpOn: boolean | null;
  float1: boolean | null;
  float2: boolean | null;
  alarmActive: boolean | null;
  alarmReason: string | null;
  alarmTempHigh: boolean | null;
  alarmTempLow: boolean | null;
  alarmFloat1: boolean | null;
  alarmFloat2: boolean | null;
  alarmPumpLowFlow: boolean | null;
  alarmWifiDisconnected: boolean | null;
  reportReason: string | null;
  intervalSeconds: number | null;
  pumpOnSeconds: number | null;
  avgFlowMlPerMin: number | null;
  createdAt: string;
};

type DevicesResponse = { devices?: Device[] };
type TelemetryResponse = { telemetry?: Telemetry[] };
type ErrorResponse = { error?: string };

type ConfigField = {
  key: string;
  label: string;
  type: "bool" | "int" | "float";
  min?: number;
  max?: number;
  step?: number;
};

const CONFIG_FIELDS: ConfigField[] = [
  { key: "uploadFreq", label: "Upload frequency (mins)", type: "int", min: 1, max: 240 },
  { key: "tenable", label: "Temp enable", type: "bool" },
  { key: "tlampshutoff", label: "High temp lamp off", type: "bool" },
  { key: "tshutofftemp", label: "Shutoff temp (C)", type: "float", min: 0, max: 100, step: 0.5 },
  { key: "thighalarm", label: "High temp alarm", type: "bool" },
  { key: "thightemp", label: "High temp threshold (C)", type: "float", min: 0, max: 100, step: 0.5 },
  { key: "tlowalarm", label: "Low temp alarm", type: "bool" },
  { key: "tlowtemp", label: "Low temp threshold (C)", type: "float", min: 0, max: 100, step: 0.5 },
  { key: "lenable", label: "Lamp enable", type: "bool" },
  { key: "lheater", label: "Lamp is heater", type: "bool" },
  { key: "ltemp", label: "Heater target temp (C)", type: "float", min: 0, max: 100, step: 0.5 },
  { key: "lstarthour", label: "Lamp on hour", type: "int", min: 0, max: 23 },
  { key: "lendhour", label: "Lamp off hour", type: "int", min: 0, max: 23 },
  { key: "linvert", label: "Lamp invert", type: "bool" },
  { key: "penable", label: "Pump enable", type: "bool" },
  { key: "pflow", label: "Pump flow mode", type: "bool" },
  { key: "pflowml", label: "Pump flow target (mL)", type: "int", min: 0, max: 100000 },
  { key: "pflowalarm", label: "Pump low-flow alarm", type: "bool" },
  { key: "pduration", label: "Pump duration (sec)", type: "int", min: 1, max: 3600 },
  { key: "pfrequency", label: "Pump frequency (min)", type: "int", min: 1, max: 1440 },
  { key: "pinvert", label: "Pump invert", type: "bool" },
  { key: "flt1enable", label: "Float 1 enable", type: "bool" },
  { key: "flt1alarm", label: "Float 1 alarm", type: "bool" },
  { key: "flt1shutoff", label: "Float 1 pump off", type: "bool" },
  { key: "flt1invert", label: "Float 1 invert", type: "bool" },
  { key: "flt2enable", label: "Float 2 enable", type: "bool" },
  { key: "flt2alarm", label: "Float 2 alarm", type: "bool" },
  { key: "flt2shutoff", label: "Float 2 pump off", type: "bool" },
  { key: "flt2invert", label: "Float 2 invert", type: "bool" },
  { key: "flwenable", label: "Flow enable", type: "bool" },
  { key: "flowpulsesml", label: "Flow pulses per mL", type: "float", min: 0, max: 10000, step: 0.5 },
  { key: "displaytype", label: "Display type (0=All, 1=Temp)", type: "int", min: 0, max: 1 },
  { key: "enablewifi", label: "Enable WiFi", type: "bool" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry[]>([]);
  const [pairCode, setPairCode] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [configForm, setConfigForm] = useState<Record<string, string | boolean>>({});
  const [status, setStatus] = useState("");
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [telemetryView, setTelemetryView] = useState<"chart" | "table">("chart");
  const [telemetryRange, setTelemetryRange] = useState<"1h" | "12h" | "24h" | "30d">("24h");

  const activeDevice = useMemo(() => {
    if (devices.length === 0) return undefined;
    return devices.find((d) => d.id === selectedDevice) ?? devices[0];
  }, [devices, selectedDevice]);
  const latestTelemetryAt = telemetry[0]?.createdAt
    ? new Date(telemetry[0].createdAt).toLocaleString()
    : null;
  const latestTelemetry = telemetry[0];
  const chartData = useMemo(
    () =>
      [...telemetry]
        .reverse()
        .map((t) => {
          let avgFlow: number | null = t.avgFlowMlPerMin ?? null;
          if (avgFlow == null && t.flowMl != null && t.intervalSeconds != null && t.intervalSeconds > 0) {
            avgFlow = Math.round((t.flowMl / t.intervalSeconds) * 60 * 100) / 100;
          }
          return {
            time: new Date(t.createdAt).toLocaleString(),
            tempC: t.tempC ?? null,
            humidity: t.humidity ?? null,
            flowMl: t.flowMl ?? null,
            avgFlowMlPerMin: avgFlow,
          };
        }),
    [telemetry]
  );

  async function loadDevices() {
    const res = await fetch("/api/devices");
    if (!res.ok) return;
    const body = (await res.json()) as DevicesResponse;
    setDevices(body.devices ?? []);
  }

  async function loadTelemetry(deviceId: string, range: "1h" | "12h" | "24h" | "30d") {
    if (!deviceId) {
      setTelemetry([]);
      return;
    }
    const query = `?deviceId=${encodeURIComponent(deviceId)}&range=${encodeURIComponent(range)}`;
    const res = await fetch(`/api/telemetry${query}`);
    if (!res.ok) return;
    const body = (await res.json()) as TelemetryResponse;
    setTelemetry(body.telemetry ?? []);
  }

  useEffect(() => {
    if (session?.user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadDevices();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (devices.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (selectedDevice !== "") setSelectedDevice("");
      return;
    }
    const selectedExists = devices.some((d) => d.id === selectedDevice);
    if (!selectedExists) {
      setSelectedDevice(devices[0].id);
    }
  }, [devices, selectedDevice]);

  useEffect(() => {
    if (activeDevice?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadTelemetry(activeDevice.id, telemetryRange);
      const next: Record<string, string | boolean> = {};
      for (const field of CONFIG_FIELDS) {
        const raw = activeDevice.desiredConfig?.[field.key];
        if (field.type === "bool") {
          next[field.key] = Boolean(raw);
        } else {
          next[field.key] =
            raw == null
              ? ""
              : typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
                ? String(raw)
                : JSON.stringify(raw);
        }
      }
      setConfigForm(next);
    } else {
      setTelemetry([]);
    }
  }, [activeDevice?.id, activeDevice?.desiredConfig, telemetryRange]);

  useEffect(() => {
    const handler = () => setIsAddDeviceOpen(true);
    window.addEventListener("hydrotek:add-device-open", handler);
    return () => window.removeEventListener("hydrotek:add-device-open", handler);
  }, []);

  if (!session?.user?.id) {
    redirect("/login");
  }

  async function confirmPairing() {
    setStatus("");
    const res = await fetch("/api/device/pairing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: pairCode }),
    });
    const body = (await res.json().catch(() => ({}))) as ErrorResponse;
    if (!res.ok) {
      setStatus(body.error ?? "Could not confirm pairing");
      return;
    }
    setStatus("Code accepted. Device is pending connection.");
    setPairCode("");
    await loadDevices();
    setIsAddDeviceOpen(false);
  }

  async function saveConfig() {
    if (!activeDevice) return;
    setStatus("");
    const settings: Record<string, boolean | number> = {};
    for (const field of CONFIG_FIELDS) {
      const raw = configForm[field.key];
      if (field.type === "bool") {
        settings[field.key] = Boolean(raw);
        continue;
      }
      if (raw === "" || raw == null) {
        setStatus(`Missing value for ${field.label}`);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        setStatus(`Invalid number for ${field.label}`);
        return;
      }
      settings[field.key] = field.type === "int" ? Math.round(parsed) : parsed;
    }
    const res = await fetch("/api/device/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: activeDevice.id, settings }),
    });
    if (!res.ok) {
      setStatus("Failed to save config");
      return;
    }
    setStatus("Config saved");
    await loadDevices();
  }

  async function removeDevice(deviceId: string) {
    await fetch("/api/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    setStatus("Device removed");
    await loadDevices();
    setIsSettingsOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="surface-card p-4 sm:p-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Dashboard - {activeDevice?.name ?? "No device"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last telemetry report: {latestTelemetryAt ?? "No telemetry yet"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsSettingsOpen(true)}
          disabled={!activeDevice}
          aria-label="Device settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
      {status && (
        <p className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-300">
          {status}
        </p>
      )}

      {devices.length === 0 && (
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">No devices paired yet. Use “Add device” in the header to pair your first device.</p>
        </div>
      )}
      {devices.length > 0 && (
        <Tabs.Root value={activeDevice?.id} onValueChange={(value) => setSelectedDevice(value)}>
          <Tabs.List className="flex flex-wrap gap-2">
            {devices.map((device) => (
              <Tabs.Trigger
                key={device.id}
                value={device.id}
                className="px-3 py-1.5 rounded-lg border text-sm font-medium bg-card hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {device.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      )}

      <Card className="surface-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold">Telemetry</h2>
          <div className="flex items-center gap-2">
            <Tabs.Root
              value={telemetryRange}
              onValueChange={(value) =>
                setTelemetryRange(value as "1h" | "12h" | "24h" | "30d")
              }
            >
              <Tabs.List className="flex gap-1 rounded-lg bg-muted p-1">
                {(["1h", "12h", "24h", "30d"] as const).map((rangeKey) => (
                  <Tabs.Trigger
                    key={rangeKey}
                    value={rangeKey}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    {rangeKey}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs.Root>
            <Button
              variant={telemetryView === "chart" ? "default" : "outline"}
              size="sm"
              onClick={() => setTelemetryView("chart")}
            >
              Chart
            </Button>
            <Button
              variant={telemetryView === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setTelemetryView("table")}
            >
              Table
            </Button>
          </div>
        </div>

        {telemetryView === "chart" ? (
          <div className="h-80 w-full rounded-lg border bg-card/70 p-2 sm:p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="tempC" name="Temp C" stroke="#ef4444" dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity %" stroke="#3b82f6" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="flowMl" name="Delivered mL" stroke="#10b981" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="avgFlowMlPerMin" name="Avg flow mL/min" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm">
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 ${latestTelemetry?.lampOn ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            <Lightbulb className="w-4 h-4" />
            <span>Lamp</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 ${latestTelemetry?.pumpOn ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            <Droplets className="w-4 h-4" />
            <span>Pump</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 ${latestTelemetry?.float1 || latestTelemetry?.float2 ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            <Waves className="w-4 h-4" />
            <span>Floats</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 ${latestTelemetry?.alarmActive ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            <AlertTriangle className="w-4 h-4" />
            <span>Alarm {latestTelemetry?.alarmReason ? `- ${latestTelemetry.alarmReason}` : ""}</span>
          </div>
        </div>

        {telemetryView === "table" ? (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-muted/40">
                <th className="p-2">Time</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Interval</th>
                <th className="p-2">Temp C</th>
                <th className="p-2">Humidity</th>
                <th className="p-2">Delivered mL</th>
                <th className="p-2">Avg mL/min</th>
                <th className="p-2">Lamp</th>
                <th className="p-2">Pump</th>
                <th className="p-2">Pump sec</th>
                <th className="p-2">Float1</th>
                <th className="p-2">Float2</th>
                <th className="p-2">Alarm</th>
                <th className="p-2">Alarm reason</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.map((t) => {
                let avgFlow: number | null = t.avgFlowMlPerMin ?? null;
                if (avgFlow == null && t.flowMl != null && t.intervalSeconds != null && t.intervalSeconds > 0) {
                  avgFlow = Math.round((t.flowMl / t.intervalSeconds) * 60 * 100) / 100;
                }
                const intervalLabel = t.intervalSeconds != null ? `${t.intervalSeconds}s` : "-";
                return (
                <tr key={t.id} className="border-b odd:bg-card even:bg-muted/20">
                  <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="p-2 text-xs">{t.reportReason ?? "-"}</td>
                  <td className="p-2">{intervalLabel}</td>
                  <td className="p-2">{t.tempC ?? "-"}</td>
                  <td className="p-2">{t.humidity ?? "-"}</td>
                  <td className="p-2">{t.flowMl ?? "-"}</td>
                  <td className="p-2">{avgFlow != null ? avgFlow : "-"}</td>
                  <td className="p-2">{t.lampOn == null ? "-" : t.lampOn ? "On" : "Off"}</td>
                  <td className="p-2">{t.pumpOn == null ? "-" : t.pumpOn ? "On" : "Off"}</td>
                  <td className="p-2">{t.pumpOnSeconds ?? "-"}</td>
                  <td className="p-2">{t.float1 == null ? "-" : t.float1 ? "Trig" : "Clear"}</td>
                  <td className="p-2">{t.float2 == null ? "-" : t.float2 ? "Trig" : "Clear"}</td>
                  <td className="p-2">{t.alarmActive ? "Yes" : "No"}</td>
                  <td className="p-2">{t.alarmActive ? t.alarmReason ?? "-" : "-"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        ) : null}
      </Card>

      <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add device</DialogTitle>
            <DialogDescription>
              Enter the 6-character code shown on the OLED.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value.toUpperCase())}
              placeholder="PAIR CODE"
            />
            <Button onClick={() => void confirmPairing()}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device settings</DialogTitle>
            <DialogDescription>
              Configure {activeDevice?.name ?? "selected device"}.
            </DialogDescription>
          </DialogHeader>
          {activeDevice ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Config sync state: {activeDevice.configSyncState}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-auto pr-1">
                {CONFIG_FIELDS.map((field) => (
                  <label key={field.key} className="text-sm space-y-1 block">
                    <span className="block text-gray-700 dark:text-gray-300">{field.label}</span>
                    {field.type === "bool" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(configForm[field.key])}
                        onChange={(e) =>
                          setConfigForm((prev) => ({ ...prev, [field.key]: e.target.checked }))
                        }
                      />
                    ) : (
                      <Input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 1}
                        value={String(configForm[field.key] ?? "")}
                        onChange={(e) =>
                          setConfigForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => void saveConfig()}>
                  Save config
                </Button>
              </DialogFooter>
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => void removeDevice(activeDevice.id)}
                >
                  Remove device
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No device selected.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
