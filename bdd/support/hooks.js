import { After, Before, Status, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium } from "playwright";

setDefaultTimeout(Number(process.env.BDD_STEP_TIMEOUT_MS ?? 15000));

Before(async function () {
  this.browser = await chromium.launch({
    headless: process.env.BDD_HEADLESS !== "false",
  });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
  this.baseURL = process.env.BDD_BASE_URL ?? "http://127.0.0.1:8080";
});

After(async function ({ result }) {
  if (result?.status === Status.FAILED && this.page) {
    await this.attach(
      await this.page.screenshot({ fullPage: true }),
      "image/png",
    );
  }
  await this.context?.close();
  await this.browser?.close();
});
