/**
 * Helper functions for AC Milan Store quick-buy tests
 */

/**
 * Clean price text by removing currency symbol, spaces, and converting comma to dot
 * @param {string} text - Price text to clean
 * @returns {string} Cleaned price string
 */
function cleanPrice(text) {
  return (text || "")
    .replace(/€/g, "")
    .replace(/[\s\xa0]/g, "")
    .replace(",", ".")
    .trim();
}

/**
 * Dismiss cookie consent banner and any visible overlays
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function dismissCookieConsent(page) {
  try {
    // Try OneTrust cookie consent
    const acceptBtn = page.locator("#onetrust-accept-btn-handler");
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (_) {
    // No cookie banner
  }

  // Also try to close any PageOverlay
  try {
    const overlay = page.locator(".PageOverlay.is-visible");
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } catch (_) {
    // No overlay
  }
}

/**
 * Get list of disabled size buttons in the quick-buy component
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string[]>} Array of disabled size labels
 */
async function getDisabledSizes(page) {
  const sizeBtns = await page
    .locator(".quick-buy .product-customization__form-section-container")
    .filter({ hasText: "Taglia" })
    .locator("button")
    .all();

  const disabled = [];
  for (const btn of sizeBtns) {
    const isDisabled = await btn.isDisabled();
    if (isDisabled) {
      const text = await btn.textContent();
      disabled.push(text?.trim());
    }
  }
  return disabled;
}

/**
 * Get the currently active button text in a specific section
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sectionName - Name of the section (e.g., "Genere", "Modello")
 * @returns {Promise<string|null>} Active button text or null
 */
async function getActiveButtonText(page, sectionName) {
  const activeBtn = page
    .locator(".quick-buy .product-customization__form-section-container")
    .filter({ hasText: sectionName })
    .locator("button.active")
    .first();

  const text = await activeBtn.textContent().catch(() => null);
  return text?.trim() || null;
}

/**
 * Get the current price displayed in the quick-buy component
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Cleaned price string
 */
async function getCurrentPrice(page) {
  const priceText = await page
    .locator(".quick-buy .price-customization")
    .textContent();
  return cleanPrice(priceText);
}

/**
 * Click a button with specific text in the quick-buy component
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} buttonText - Text of the button to click
 * @param {number} waitTime - Time to wait after click (ms)
 */
async function clickQuickBuyButton(page, buttonText, waitTime = 500) {
  await page
    .locator(`.quick-buy button:has-text("${buttonText}")`)
    .first()
    .click();
  await page.waitForTimeout(waitTime);
}

module.exports = {
  cleanPrice,
  dismissCookieConsent,
  getDisabledSizes,
  getActiveButtonText,
  getCurrentPrice,
  clickQuickBuyButton,
};
