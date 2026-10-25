// The local editor's entry point (dev only): the ✎ button in ⚙, reopening after a save
// (the editor leaves a note in sessionStorage before the page reloads), one editor at a time.

import { expect, test, vi } from "vitest";
import { $, boot, go } from "./test/app-harness.ts";

// Booting the page and drawing it in software WebGL is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const openEditor = vi.fn();
vi.mock("./editor.ts", () => ({ openEditor }));

const { viewer } = await boot({ before: () => sessionStorage.setItem("bjj3d.editor", "a saved block") });

test("a save note reopens the editor at boot", async () => {
  await vi.waitFor(() => expect(openEditor).toHaveBeenCalledOnce());
  expect(openEditor.mock.calls[0][0].viewer).toBe(viewer);
});

test("the button does nothing while the editor is open, and opens it again once closed", async () => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("#settings .actions button")).find((b) => b.textContent!.includes("Editor"))!;
  button.click();
  await Promise.resolve();
  expect(openEditor).toHaveBeenCalledOnce();
  location.hash = "t/458";
  openEditor.mock.calls[0][0].onClose();
  expect($("#title").textContent).not.toBe("");
  $("#settings-btn").click();
  button.click();
  await vi.waitFor(() => expect(openEditor).toHaveBeenCalledTimes(2));
  expect($("#settings").hidden).toBe(true);
  await go("t/0");
});
