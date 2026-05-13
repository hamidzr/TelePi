import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readSessionHeader,
  resolveSessionPathForRuntime,
  resolveWorkspacePathForRuntime,
} from "../src/pi-session-paths.js";

describe("pi session paths", () => {
  const originalEnv = process.env;
  let tempDir: string;
  let homeDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "telepi-session-paths-"));
    homeDir = path.join(tempDir, "home");
    mkdirSync(homeDir, { recursive: true });
    process.env = { ...originalEnv, HOME: homeDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("expands existing session paths for the runtime", () => {
    const sessionPath = path.join(homeDir, "session.jsonl");
    writeFileSync(sessionPath, "");

    expect(resolveSessionPathForRuntime("~/session.jsonl")).toBe(sessionPath);
  });

  it("keeps missing session paths unchanged after expansion", () => {
    const sessionPath = path.join(tempDir, "missing", "session.jsonl");

    expect(resolveSessionPathForRuntime(sessionPath)).toBe(sessionPath);
  });

  it("reads valid session headers", () => {
    const sessionPath = path.join(tempDir, "valid.jsonl");
    writeFileSync(
      sessionPath,
      `${JSON.stringify({
        type: "session",
        id: "session-1",
        cwd: "/workspace/project",
      })}\n${JSON.stringify({ type: "message" })}\n`,
    );

    expect(readSessionHeader(sessionPath)).toEqual({
      id: "session-1",
      cwd: "/workspace/project",
    });
  });

  it("ignores invalid session headers", () => {
    const sessionPath = path.join(tempDir, "invalid.jsonl");

    expect(readSessionHeader(path.join(tempDir, "missing.jsonl"))).toBeUndefined();

    writeFileSync(sessionPath, "\n");
    expect(readSessionHeader(sessionPath)).toBeUndefined();

    writeFileSync(sessionPath, "not-json\n");
    expect(readSessionHeader(sessionPath)).toBeUndefined();

    writeFileSync(sessionPath, `${JSON.stringify({ type: "message", id: "message-1" })}\n`);
    expect(readSessionHeader(sessionPath)).toBeUndefined();

    writeFileSync(sessionPath, `${JSON.stringify({ type: "session", id: 123 })}\n`);
    expect(readSessionHeader(sessionPath)).toBeUndefined();
  });

  it("returns only existing workspace paths", () => {
    expect(resolveWorkspacePathForRuntime(undefined)).toBeUndefined();
    expect(resolveWorkspacePathForRuntime(tempDir)).toBe(tempDir);
    expect(resolveWorkspacePathForRuntime(path.join(tempDir, "missing"))).toBeUndefined();
  });
});
