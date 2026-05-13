import { renderCommandPickerState, type PendingCommandPicker } from "../../src/bot/command-picker.js";
import type { CommandPickerEntry } from "../../src/bot/slash-command.js";

function makePicker(overrides: Partial<PendingCommandPicker> = {}): PendingCommandPicker {
  const entries: CommandPickerEntry[] = [
    {
      id: 0,
      kind: "telepi",
      command: "start",
      commandText: "/start",
      label: "📱 /start",
      description: "Welcome and session info",
    },
    ...Array.from({ length: 7 }, (_, index): CommandPickerEntry => ({
      id: index + 1,
      kind: "pi",
      name: `review-${index}`,
      commandText: `/review-${index}`,
      label: `⚡ /review-${index}`,
      description: `Review ${index}`,
      source: "prompt",
    })),
  ];

  return {
    messageId: 123,
    entries,
    filter: "all",
    page: 0,
    ...overrides,
  };
}

describe("command picker rendering", () => {
  it("renders paginated command entries and filter counts", () => {
    const rendered = renderCommandPickerState(makePicker({ page: 1 }));

    expect(rendered.page).toBe(1);
    expect(rendered.filteredEntries.map((entry) => entry.commandText)).toHaveLength(8);
    expect(rendered.text).toContain("Showing 7-8 of 8 All commands.");
    expect(rendered.fallbackText).toContain("/review-5");
    const filterRow = rendered.replyMarkup.inline_keyboard.at(-2);
    expect(filterRow?.map((button) => button.callback_data)).toEqual([
      "cmd_filter_all",
      "cmd_filter_telepi",
      "cmd_filter_pi",
    ]);
    expect(filterRow?.map((button) => button.text)).toEqual([
      "✅ 🧭 All 8",
      "📱 TelePi 1",
      "⚡ Pi 7",
    ]);
  });

  it("clamps pages and renders empty filtered states", () => {
    const rendered = renderCommandPickerState(makePicker({
      entries: [makePicker().entries[0]],
      filter: "pi",
      page: 99,
    }));

    expect(rendered.page).toBe(0);
    expect(rendered.filteredEntries).toEqual([]);
    expect(rendered.text).toContain("No Pi commands found in this session.");
    expect(rendered.fallbackText).toContain("No Pi commands found in this session.");
  });
});
