import { test, expect } from "@playwright/test"

test("home page renders the hero", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("Prabhat Samgiita AI")).toBeVisible()
})
