// Optional maintainer helper. Requires a one-off:
//   npm install --no-save playwright && npx playwright install chromium
//   npm run screenshots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://the-cheese-atlas.vercel.app/", { waitUntil: "networkidle" });
await page.waitForSelector(".card");

await page.screenshot({
  path: path.join(OUT, "01-hero.png"),
  clip: { x: 0, y: 0, width: 1280, height: 520 },
});

await page.locator(".controls").screenshot({ path: path.join(OUT, "02-controls.png") });

await page.evaluate(() => window.scrollTo(0, document.querySelector(".grid-section").offsetTop - 40));
await page.waitForTimeout(250);
await page.locator(".grid").screenshot({ path: path.join(OUT, "03-card-grid.png") });

await page.getByRole("button", { name: /Parmigiano Reggiano/i }).click();
await page.waitForSelector(".modal");
await page.waitForTimeout(800);
const img = page.locator(".modal img");
if (await img.count()) {
  await img.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}
await page.locator(".modal").screenshot({ path: path.join(OUT, "04-detail-modal.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.getByRole("button", { name: "Blue", exact: true }).click();
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, document.querySelector(".grid-section").offsetTop - 80));
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(OUT, "05-family-filter.png"),
  clip: { x: 0, y: 0, width: 1280, height: 700 },
});

await browser.close();
console.log("Screenshots saved to", OUT);
