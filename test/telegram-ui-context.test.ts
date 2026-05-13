import { describe, expect, it, vi } from "vitest";

import { createTelegramUIContext } from "../src/telegram-ui-context.js";

describe("createTelegramUIContext", () => {
  it("forwards notifications to the provided callback", () => {
    const notify = vi.fn();
    const ui = createTelegramUIContext({ notify });

    ui.notify("Something happened", "warning");

    expect(notify).toHaveBeenCalledWith("Something happened", "warning");
  });

  it("delegates interactive UI methods when handlers are provided", async () => {
    const ui = createTelegramUIContext({
      notify: vi.fn(),
      select: vi.fn().mockResolvedValue("b"),
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn().mockResolvedValue("Bene"),
    });

    await expect(ui.select("Pick one", ["a", "b"]))
      .resolves.toBe("b");
    await expect(ui.confirm("Confirm", "Continue?"))
      .resolves.toBe(true);
    await expect(ui.input("Name"))
      .resolves.toBe("Bene");
  });

  it("fails clearly for unsupported interactive UI methods", async () => {
    const ui = createTelegramUIContext({ notify: vi.fn() });

    await expect(ui.select("Pick one", ["a", "b"]))
      .rejects.toThrow("TelePi does not yet support extension UI method 'select'.");
    await expect(ui.confirm("Confirm", "Continue?"))
      .rejects.toThrow("TelePi does not yet support extension UI method 'confirm'.");
    await expect(ui.input("Name"))
      .rejects.toThrow("TelePi does not yet support extension UI method 'input'.");
  });

  it("exposes setHiddenThinkingLabel as a no-op for compatibility", () => {
    const ui = createTelegramUIContext({ notify: vi.fn() });

    expect(() => ui.setHiddenThinkingLabel("Thinking…")).not.toThrow();
    expect(() => ui.setHiddenThinkingLabel()).not.toThrow();
  });

  it("provides safe defaults for terminal-only UI state", () => {
    const ui = createTelegramUIContext({ notify: vi.fn() });

    expect(() => ui.onTerminalInput(() => undefined)()).not.toThrow();
    expect(() => ui.setStatus("Ready")).not.toThrow();
    expect(() => ui.setWorkingMessage("Working")).not.toThrow();
    expect(() => ui.setWidget(undefined)).not.toThrow();
    expect(() => ui.setFooter(undefined)).not.toThrow();
    expect(() => ui.setHeader(undefined)).not.toThrow();
    expect(() => ui.setTitle("Title")).not.toThrow();
    expect(() => ui.pasteToEditor("text")).not.toThrow();
    expect(() => ui.setEditorText("text")).not.toThrow();
    expect(() => ui.setEditorComponent(undefined)).not.toThrow();
    expect(() => ui.setToolsExpanded(true)).not.toThrow();
    expect(() => ui.setWorkingVisible(true)).not.toThrow();
    expect(() => ui.setWorkingIndicator("spinner")).not.toThrow();
    expect(ui.getEditorText()).toBe("");
    expect(ui.getAllThemes()).toEqual([]);
    expect(ui.getTheme()).toBeUndefined();
    expect(ui.setTheme("default")).toEqual({
      success: false,
      error: "TelePi does not support theme switching through extension UI.",
    });
    expect(ui.getToolsExpanded()).toBe(false);
    expect(ui.getEditorComponent()).toBeUndefined();
  });

  it("fails clearly for unsupported terminal-only UI methods", async () => {
    const ui = createTelegramUIContext({ notify: vi.fn() });

    await expect(ui.custom({} as never)).rejects.toThrow(
      "TelePi does not yet support extension UI method 'custom'.",
    );
    await expect(ui.editor({} as never)).rejects.toThrow(
      "TelePi does not yet support extension UI method 'editor'.",
    );
    expect(() => ui.addAutocompleteProvider({} as never)).toThrow(
      "TelePi does not yet support extension UI method 'addAutocompleteProvider'.",
    );
  });

  it("provides a plain-text theme shim for extension compatibility", () => {
    const ui = createTelegramUIContext({ notify: vi.fn() });

    expect(ui.theme.fg("accent", "hello")).toBe("hello");
    expect(ui.theme.bg("selectedBg", "hello")).toBe("hello");
    expect(ui.theme.bold("hello")).toBe("hello");
    expect(ui.theme.italic("hello")).toBe("hello");
    expect(ui.theme.underline("hello")).toBe("hello");
    expect(ui.theme.inverse("hello")).toBe("hello");
    expect(ui.theme.strikethrough("hello")).toBe("hello");
    expect(ui.theme.getFgAnsi("accent")).toBe("");
    expect(ui.theme.getBgAnsi("selectedBg")).toBe("");
    expect(ui.theme.getColorMode()).toBe("truecolor");
    expect(ui.theme.getThinkingBorderColor("medium")("hello")).toBe("hello");
    expect(ui.theme.getBashModeBorderColor()("hello")).toBe("hello");
  });
});
