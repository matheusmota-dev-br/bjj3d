import { expect, type Page } from "@playwright/test";

export const SETTINGS_KEY = "bjj-3d.settings.v2";
/** The knee-on-belly armbar: a reviewed technique whose lock reaches the danger range. */
export const ARMBAR = "t/458";

/**
 * Opens the app on the scratch graph. Unless `firstVisit`, the visitor has seen the help and
 * the start greeting is off, so playback starts at once; settings saved later in the test
 * (and across reloads) win over these.
 */
export async function open(page: Page, hash = "", opts: { firstVisit?: boolean; oss?: boolean; query?: string } = {}) {
  if (!opts.firstVisit) {
    await page.addInitScript(([key, oss]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ helpSeen: true, oss }));
    }, [SETTINGS_KEY, opts.oss ?? false] as const);
  }
  await page.goto(`/?graph=e2e/graph.json${opts.query ? `&${opts.query}` : ""}${hash ? `#${hash}` : ""}`);
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
}

/** The viewer, exposed by ?debug=1. */
export const viewerState = (page: Page) =>
  page.evaluate(() => {
    const v = (window as unknown as { viewer: { time: number; last: number; playing: boolean; cameraMode: string } }).viewer;
    return { time: v.time, last: v.last, playing: v.playing, cameraMode: v.cameraMode };
  });

export const savedSettings = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SETTINGS_KEY);
