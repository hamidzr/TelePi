import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";

const mockState = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawnSync: mockState.spawnSync,
}));

import {
  getInstalledConfigStatus,
  getLaunchAgentStatus,
  readLaunchAgentEnvironmentVariables,
  readLaunchAgentWorkingDirectory,
  reconcileLaunchAgent,
} from "../../src/install/launchd.js";
import type { TelePiInstallContext } from "../../src/install/shared.js";

describe("launchd install helpers", () => {
  const originalPlatform = process.platform;
  let tempDir: string;
  let context: TelePiInstallContext;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "telepi-launchd-"));
    context = makeContext(tempDir);
    mockState.spawnSync.mockReset();
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parses loaded launchd status output", () => {
    writeFileSync(context.launchAgentPath, "plist");
    mockState.spawnSync.mockReturnValueOnce({
      status: 0,
      stdout: "state = running\npid = 42\n",
      stderr: "",
      error: undefined,
    });

    expect(getLaunchAgentStatus(context)).toEqual({
      plistExists: true,
      loaded: true,
      state: "running",
      pid: 42,
      detail: "loaded",
      error: undefined,
    });
    expect(mockState.spawnSync).toHaveBeenCalledWith("launchctl", ["print", "gui/501/com.telepi"], expect.any(Object));
  });

  it("reports unloaded launchd status with cleaned command output", () => {
    writeFileSync(context.launchAgentPath, "plist");
    mockState.spawnSync.mockReturnValueOnce({
      status: 113,
      stdout: "",
      stderr: "Could not find service\n  extra detail\n",
      error: undefined,
    });

    expect(getLaunchAgentStatus(context)).toEqual({
      plistExists: true,
      loaded: false,
      state: undefined,
      pid: undefined,
      detail: "installed but not loaded",
      error: "Could not find service extra detail",
    });
  });

  it("reconciles launchd successfully", () => {
    mockState.spawnSync
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined });

    expect(reconcileLaunchAgent(context)).toEqual({
      actions: [
        `bootout ${context.launchAgentDomain} ${context.launchAgentPath}`,
        `bootstrap ${context.launchAgentDomain} ${context.launchAgentPath}`,
        `enable ${context.launchAgentServiceTarget}`,
        `kickstart -k ${context.launchAgentServiceTarget}`,
      ],
      warning: undefined,
    });
  });

  it("returns bootstrap failures as warnings", () => {
    mockState.spawnSync
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "", error: undefined })
      .mockReturnValueOnce({ status: 5, stdout: "", stderr: "bootstrap failed\n", error: undefined });

    expect(reconcileLaunchAgent(context)).toEqual({
      actions: [`bootout ${context.launchAgentDomain} ${context.launchAgentPath}`],
      warning: "launchctl bootstrap failed: bootstrap failed",
    });
  });

  it("resolves installed config status without a launch agent plist", () => {
    expect(getInstalledConfigStatus(context)).toEqual({
      resolvedPath: context.configPath,
      source: "installed-default",
    });
  });

  it("resolves installed config status from launchd working-directory env", () => {
    const workingDirectory = path.join(tempDir, "work");
    mkdirSync(workingDirectory, { recursive: true });
    const localConfigPath = path.join(workingDirectory, ".env");
    writeFileSync(localConfigPath, "TELEGRAM_BOT_TOKEN=test\n");
    writeFileSync(
      context.launchAgentPath,
      [
        "<plist>",
        "<key>WorkingDirectory</key>",
        `<string>${workingDirectory}</string>`,
        "</plist>",
      ].join("\n"),
    );

    expect(getInstalledConfigStatus(context)).toEqual({
      resolvedPath: localConfigPath,
      source: "launchd-cwd",
    });
  });

  it("resolves explicit launchd TELEPI_CONFIG relative to working directory", () => {
    const workingDirectory = path.join(tempDir, "work");
    mkdirSync(workingDirectory, { recursive: true });
    writeFileSync(
      context.launchAgentPath,
      [
        "<plist>",
        "<key>WorkingDirectory</key>",
        `<string>${workingDirectory}</string>`,
        "<key>EnvironmentVariables</key>",
        "<dict>",
        "<key>TELEPI_CONFIG</key>",
        "<string>config/telepi.env</string>",
        "</dict>",
        "</plist>",
      ].join("\n"),
    );

    expect(getInstalledConfigStatus(context)).toEqual({
      resolvedPath: path.join(workingDirectory, "config", "telepi.env"),
      source: "launchd-env",
    });
  });

  it("reads launchd working directory and environment values", () => {
    const plist = [
      "<plist>",
      "<key>WorkingDirectory</key>",
      "<string>/tmp/work &amp; space</string>",
      "<key>EnvironmentVariables</key>",
      "<dict>",
      "<key>TELEPI_CONFIG</key>",
      "<string>/tmp/config.env</string>",
      "<key>QUOTED</key>",
      "<string>&quot;value&quot;</string>",
      "</dict>",
      "</plist>",
    ].join("\n");

    expect(readLaunchAgentWorkingDirectory(plist)).toBe("/tmp/work & space");
    expect(readLaunchAgentEnvironmentVariables(plist)).toEqual({
      TELEPI_CONFIG: "/tmp/config.env",
      QUOTED: '"value"',
    });
  });
});

function makeContext(root: string): TelePiInstallContext {
  mkdirSync(root, { recursive: true });
  return {
    packageRoot: root,
    cliEntrypointPath: path.join(root, "dist", "cli.js"),
    envExamplePath: path.join(root, ".env.example"),
    launchdTemplatePath: path.join(root, "launchd", "com.telepi.plist"),
    extensionSourcePath: path.join(root, "extensions", "telepi-handoff.ts"),
    configPath: path.join(root, "config.env"),
    launchAgentPath: path.join(root, "com.telepi.plist"),
    launchAgentLabel: "com.telepi",
    launchAgentDomain: "gui/501",
    launchAgentServiceTarget: "gui/501/com.telepi",
    launchAgentLogsDirectory: path.join(root, "logs"),
    launchAgentStdoutPath: path.join(root, "logs", "out.log"),
    launchAgentStderrPath: path.join(root, "logs", "err.log"),
    extensionDestinationPath: path.join(root, "telepi-handoff.ts"),
    nodeExecutablePath: process.execPath,
    workingDirectory: root,
    pathEnvironment: "/usr/bin",
    version: "1.2.3",
  };
}
