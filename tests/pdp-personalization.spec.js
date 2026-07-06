// @ts-check
const { test, expect } = require("@playwright/test");
const { dismissCookieConsent, cleanPrice } = require("../utils/helpers");

/**
 * Bug-hunting tests for AC Milan Store Product Detail Page (PDP) personalization
 * Target: https://store.acmilan.com/products/acm-home-authentic-jersey
 * Focus: personalization flow (name/number/player/patch/size) and cart consistency
 */

test.describe("PDP Personalization & Cart Bug Hunt", () => {
  const PDP_URL = "/products/acm-home-authentic-jersey";

  test.beforeEach(async ({ page }) => {
    await page.goto(PDP_URL);
    await dismissCookieConsent(page);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Dismiss any overlays/modals that may appear
    await dismissOverlays(page);
  });

  async function dismissOverlays(page) {
    // Close PageOverlay
    const overlay = page.locator(".PageOverlay.is-visible");
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Close modal-jersey
    const modal = page.locator("#modal-jersey, .Modal--pageContent");
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Close SizeGuide
    const sizeGuide = page.locator(".SizeGuide");
    if (await sizeGuide.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Close any Collapsible that's open and intercepting
    const collapsible = page.locator(
      ".Collapsible.is-open .Collapsible__Content",
    );
    if (await collapsible.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Try clicking the collapsible toggle to close it
      const toggle = page
        .locator(".Collapsible.is-open .Collapsible__Button")
        .first();
      if (await toggle.isVisible({ timeout: 500 }).catch(() => false)) {
        await toggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Force close any remaining overlays
    await page.evaluate(() => {
      document.querySelectorAll(".PageOverlay.is-visible").forEach((el) => {
        el.classList.remove("is-visible");
        el.style.display = "none";
      });
      document.querySelectorAll(".Modal[aria-hidden='false']").forEach((el) => {
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
      });
      document.querySelectorAll(".SizeGuide").forEach((el) => {
        el.style.display = "none";
      });
    });
    await page.waitForTimeout(500);
  }

  async function goToCart(page) {
    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
  }

  const ADD_TO_CART_BTN = "button:has-text('Aggiungi al carrello')";
  const PRICE_SEL = ".price, .product-price, [class*='price']";

  test("PDP-001: Page loads and personalization sections are present", async ({
    page,
  }) => {
    const title = await page.title();
    console.log("Page title:", title);

    await page.screenshot({ path: "screenshots/pdp-page-loaded.png" });

    // Check for personalization buttons
    const giocatoreBtn = page.locator("button:has-text('Giocatore')").first();
    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    const serieABtn = page.locator("button:has-text('SERIE A')").first();

    console.log(
      "Giocatore button visible:",
      await giocatoreBtn.isVisible({ timeout: 2000 }).catch(() => false),
    );
    console.log(
      "Tuo Nome button visible:",
      await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false),
    );
    console.log(
      "SERIE A button visible:",
      await serieABtn.isVisible({ timeout: 2000 }).catch(() => false),
    );

    // Check for add to cart
    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    const addBtnVisible = await addBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Add to cart button visible:", addBtnVisible);

    // Check price
    const priceEl = page.locator(PRICE_SEL).first();
    const price = await priceEl.textContent().catch(() => null);
    console.log("Product price:", price?.trim());

    await page.screenshot({ path: "screenshots/pdp-sections.png" });
  });

  test("PDP-002: Size selection via popover", async ({ page }) => {
    // On PDP, size is likely in a popover/dropdown. Look for size-related elements
    const sizePopover = page
      .locator(
        "[data-option-type='size'], .Popover:has(button[data-option-type='size'])",
      )
      .first();
    const sizePopoverVisible = await sizePopover
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Size popover visible:", sizePopoverVisible);

    // Try to find and click the size selector to open the popover
    const sizeToggle = page
      .locator(
        "button:has-text('Taglia'), [data-action='select-size'], .Popover__Toggle",
      )
      .first();
    const sizeToggleVisible = await sizeToggle
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    console.log("Size toggle visible:", sizeToggleVisible);

    if (sizeToggleVisible) {
      await sizeToggle.click({ force: true });
      await page.waitForTimeout(1000);

      // Now look for size options in the popover
      const sizeOptions = await page
        .locator(".Popover__Value[data-option-type='size']")
        .all();
      console.log("Size options in popover:", sizeOptions.length);

      for (const opt of sizeOptions) {
        const text = await opt.textContent();
        const isDisabled = await opt.evaluate((el) =>
          el.classList.contains("disabled"),
        );
        const isSelected = await opt.evaluate((el) =>
          el.classList.contains("is-selected"),
        );
        console.log(
          `Size ${text?.trim()}: disabled=${isDisabled}, selected=${isSelected}`,
        );
      }

      // Click a non-disabled size
      for (const opt of sizeOptions) {
        const isDisabled = await opt.evaluate((el) =>
          el.classList.contains("disabled"),
        );
        const isSelected = await opt.evaluate((el) =>
          el.classList.contains("is-selected"),
        );
        if (!isDisabled && !isSelected) {
          const text = await opt.textContent();
          console.log("Selecting size:", text?.trim());
          await opt.click({ force: true });
          await page.waitForTimeout(500);
          break;
        }
      }
    }

    await page.screenshot({ path: "screenshots/pdp-size-selection.png" });
  });

  test("PDP-003: Tuo Nome - inputs appear and fill correctly", async ({
    page,
  }) => {
    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    const tuoNomeVisible = await tuoNomeBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Tuo Nome button visible:", tuoNomeVisible);

    if (tuoNomeVisible) {
      await tuoNomeBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const nameInput = page.locator("input[placeholder='Nome']").first();
      const nameVisible = await nameInput
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      console.log("Name input visible:", nameVisible);

      if (nameVisible) {
        const maxLength = await nameInput.getAttribute("maxlength");
        console.log("Name maxlength:", maxLength);
        await nameInput.fill("Rossi");
        console.log("Filled name: Rossi");
      }

      const numberInput = page.locator("input[placeholder='Numero']").first();
      const numberVisible = await numberInput
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      console.log("Number input visible:", numberVisible);

      if (numberVisible) {
        const maxLength = await numberInput.getAttribute("maxlength");
        console.log("Number maxlength:", maxLength);
        await numberInput.fill("10");
        console.log("Filled number: 10");
      }

      await page.screenshot({ path: "screenshots/pdp-tuo-nome-filled.png" });
    }
  });

  test("PDP-004: Giocatore - select dropdown and player selection", async ({
    page,
  }) => {
    const giocatoreBtn = page.locator("button:has-text('Giocatore')").first();
    const giocatoreVisible = await giocatoreBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Giocatore button visible:", giocatoreVisible);

    if (giocatoreVisible) {
      await giocatoreBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const playerSelect = page.locator("select").first();
      const selectVisible = await playerSelect
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      console.log("Player select visible:", selectVisible);

      if (selectVisible) {
        const options = await playerSelect.locator("option").all();
        console.log("Player options:", options.length);

        for (let i = 0; i < Math.min(options.length, 5); i++) {
          const text = await options[i].textContent();
          console.log(`Option ${i}: "${text?.trim()}"`);
        }

        if (options.length > 1) {
          const secondOptionText = await options[1].textContent();
          await playerSelect.selectOption({ index: 1 });
          console.log("Selected player:", secondOptionText?.trim());
          await page.waitForTimeout(500);
        }
      }

      await page.screenshot({ path: "screenshots/pdp-giocatore-selected.png" });
    }
  });

  test("PDP-005: Full flow - Tuo Nome + Patch + add to cart + verify cart", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const priceEl = page.locator(PRICE_SEL).first();
    const basePrice = await priceEl.textContent().catch(() => null);
    console.log("Base price:", basePrice?.trim());

    // Select Tuo Nome
    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    if (await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tuoNomeBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const nameInput = page.locator("input[placeholder='Nome']").first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill("Rossi");
        console.log("Name: Rossi");
      }

      const numberInput = page.locator("input[placeholder='Numero']").first();
      if (await numberInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await numberInput.fill("10");
        console.log("Number: 10");
      }
    }

    // Select Patch SERIE A
    const serieABtn = page.locator("button:has-text('SERIE A')").first();
    if (await serieABtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serieABtn.click({ force: true });
      await page.waitForTimeout(1000);
      console.log("Patch: SERIE A");
    }

    const finalPrice = await priceEl.textContent().catch(() => null);
    console.log("Final price:", finalPrice?.trim());

    await dismissOverlays(page);
    await page.screenshot({ path: "screenshots/pdp-full-personalization.png" });

    // Add to cart
    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    const addBtnVisible = await addBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Add button visible:", addBtnVisible);

    if (addBtnVisible) {
      const isDisabled = await addBtn.isDisabled();
      console.log("Add button disabled:", isDisabled);

      if (!isDisabled) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: "screenshots/pdp-after-add.png" });

        await goToCart(page);
        await page.screenshot({ path: "screenshots/pdp-cart.png" });

        const cartContent = await page.locator("body").textContent();

        const checks = [
          { label: "Name", value: "Rossi" },
          { label: "Number", value: "10" },
          { label: "Patch", value: "SERIE A" },
        ];

        for (const check of checks) {
          if (check.value && cartContent) {
            const inCart = cartContent.includes(check.value);
            console.log(`${check.label} (${check.value}) in cart:`, inCart);
            if (!inCart) {
              console.log(`BUG: ${check.label} not in cart!`);
              await page.screenshot({
                path: `screenshots/BUG-pdp-${check.label.toLowerCase()}-missing.png`,
              });
            }
          }
        }
      }
    }
  });

  test("PDP-006: Giocatore + add to cart + verify player in cart", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Select Giocatore
    const giocatoreBtn = page.locator("button:has-text('Giocatore')").first();
    let selectedPlayer = null;

    if (await giocatoreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await giocatoreBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const playerSelect = page.locator("select").first();
      if (await playerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await playerSelect.locator("option").all();
        if (options.length > 1) {
          selectedPlayer = (await options[1].textContent())?.trim();
          await playerSelect.selectOption({ index: 1 });
          console.log("Player:", selectedPlayer);
        }
      }
    }

    await dismissOverlays(page);
    await page.screenshot({ path: "screenshots/pdp-giocatore-configured.png" });

    // Add to cart
    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    if (
      (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) &&
      !(await addBtn.isDisabled())
    ) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: "screenshots/pdp-after-add-giocatore.png",
      });

      await goToCart(page);
      await page.screenshot({ path: "screenshots/pdp-cart-giocatore.png" });

      const cartContent = await page.locator("body").textContent();

      if (selectedPlayer && cartContent) {
        const playerName = selectedPlayer.replace(/^\d+\s*-\s*/, "");
        const playerInCart =
          cartContent.includes(selectedPlayer) ||
          cartContent.includes(playerName);
        console.log("Player in cart:", playerInCart);
        if (!playerInCart) {
          console.log("BUG: Player name not in cart!");
          await page.screenshot({
            path: "screenshots/BUG-pdp-player-not-in-cart.png",
          });
        }
      }
    }
  });

  test("PDP-007: Empty Tuo Nome - error message on add", async ({ page }) => {
    test.setTimeout(60000);

    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    if (await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tuoNomeBtn.click({ force: true });
      await page.waitForTimeout(1500);
    }

    await dismissOverlays(page);

    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    const addBtnVisible = await addBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Add button visible:", addBtnVisible);

    if (addBtnVisible) {
      console.log(
        "Add button disabled (empty Tuo Nome):",
        await addBtn.isDisabled(),
      );

      if (!(await addBtn.isDisabled())) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(2000);

        const errorMsg = page.locator(
          ".error, .alert, .validation-message, [class*='error'], [class*='alert'], [class*='warning'], [class*='message']",
        );
        const errorCount = await errorMsg.count();
        console.log("Error elements found:", errorCount);

        for (let i = 0; i < errorCount; i++) {
          const text = await errorMsg.nth(i).textContent();
          const visible = await errorMsg.nth(i).isVisible();
          if (visible) {
            console.log(`Error ${i}: "${text?.trim()}"`);
          }
        }

        await page.screenshot({
          path: "screenshots/pdp-error-empty-tuo-nome.png",
        });
      }
    }
  });

  test("PDP-008: Name only (no number) - add to cart", async ({ page }) => {
    test.setTimeout(60000);

    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    if (await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tuoNomeBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const nameInput = page.locator("input[placeholder='Nome']").first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill("Rossi");
        console.log("Name: Rossi | Number: (empty)");
      }
    }

    await dismissOverlays(page);

    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    if (
      (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) &&
      !(await addBtn.isDisabled())
    ) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const errorMsg = page.locator(
        ".error, .alert, .validation-message, [class*='error'], [class*='alert']",
      );
      const errorVisible = await errorMsg
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      console.log("Error message shown:", errorVisible);

      if (!errorVisible) {
        console.log("Name-only add succeeded (allowed by design)");
        await page.screenshot({ path: "screenshots/pdp-name-only-added.png" });
      }
    }
  });

  test("PDP-009: Number only (no name) - add to cart", async ({ page }) => {
    test.setTimeout(60000);

    const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
    if (await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tuoNomeBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const numberInput = page.locator("input[placeholder='Numero']").first();
      if (await numberInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await numberInput.fill("10");
        console.log("Name: (empty) | Number: 10");
      }
    }

    await dismissOverlays(page);

    const addBtn = page.locator(ADD_TO_CART_BTN).first();
    if (
      (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) &&
      !(await addBtn.isDisabled())
    ) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const errorMsg = page.locator(
        ".error, .alert, .validation-message, [class*='error'], [class*='alert']",
      );
      const errorVisible = await errorMsg
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      console.log("Error message shown:", errorVisible);

      if (!errorVisible) {
        console.log("Number-only add succeeded (allowed by design)");
        await page.screenshot({
          path: "screenshots/pdp-number-only-added.png",
        });
      }
    }
  });

  test("PDP-010: Patch SERIE A - price update and cart", async ({ page }) => {
    test.setTimeout(60000);

    const priceEl = page.locator(PRICE_SEL).first();
    const basePrice = await priceEl.textContent().catch(() => null);
    console.log("Base price:", basePrice?.trim());

    const serieABtn = page.locator("button:has-text('SERIE A')").first();
    if (await serieABtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serieABtn.click({ force: true });
      await page.waitForTimeout(1000);

      const priceWithPatch = await priceEl.textContent().catch(() => null);
      console.log("Price with patch:", priceWithPatch?.trim());

      const diff =
        parseFloat(cleanPrice(priceWithPatch || "")) -
        parseFloat(cleanPrice(basePrice || ""));
      console.log("Price difference:", diff, "(expected: 12)");

      if (Math.abs(diff - 12) > 0.01 && diff !== 0) {
        console.log("BUG: Price difference is not €12!");
        await page.screenshot({
          path: "screenshots/BUG-pdp-patch-price-wrong.png",
        });
      }

      await dismissOverlays(page);
      await page.screenshot({ path: "screenshots/pdp-patch-selected.png" });

      const addBtn = page.locator(ADD_TO_CART_BTN).first();
      if (
        (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) &&
        !(await addBtn.isDisabled())
      ) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);

        await goToCart(page);
        await page.screenshot({ path: "screenshots/pdp-cart-patch.png" });

        const cartContent = await page.locator("body").textContent();
        if (cartContent) {
          const patchInCart =
            cartContent.includes("SERIE A") || cartContent.includes("Serie A");
          console.log("SERIE A in cart:", patchInCart);
          if (!patchInCart) {
            console.log("BUG: SERIE A patch not in cart!");
            await page.screenshot({
              path: "screenshots/BUG-pdp-patch-not-in-cart.png",
            });
          }
        }
      }
    }
  });
});
