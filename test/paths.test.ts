import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  expandHomePath,
  getDefaultTelePiConfigPath,
  getHomeDirectory,
  resolvePathFromCwd,
} from "../src/paths.js";

describe("paths", () => {
  const originalEnv = process.env;
  let tempDir: string;
  let homeDir: string;
  let cwdDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "telepi-paths-"));
    homeDir = path.join(tempDir, "home");
    cwdDir = path.join(tempDir, "cwd");
    mkdirSync(homeDir, { recursive: true });
    mkdirSync(cwdDir, { recursive: true });
    process.env = { ...originalEnv, HOME: homeDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("uses HOME when present", () => {
    expect(getHomeDirectory()).toBe(homeDir);
  });

  it("expands home-prefixed paths", () => {
    expect(expandHomePath("~")).toBe(homeDir);
    expect(expandHomePath("~/project/file.txt")).toBe(path.join(homeDir, "project", "file.txt"));
    expect(expandHomePath("~\\project\\file.txt")).toBe(path.join(homeDir, "project\\file.txt"));
  });

  it("trims and resolves paths from a cwd", () => {
    expect(resolvePathFromCwd(" ./relative/file.txt ", cwdDir)).toBe(path.join(cwdDir, "relative", "file.txt"));
    expect(resolvePathFromCwd(path.join(tempDir, "absolute.txt"), cwdDir)).toBe(path.join(tempDir, "absolute.txt"));
  });

  it("builds the default config path", () => {
    expect(getDefaultTelePiConfigPath(homeDir)).toBe(path.join(homeDir, ".config", "telepi", "config.env"));
  });
});
