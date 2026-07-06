// @ts-check
const { test, expect } = require("@playwright/test");
const {
  dismissCookieConsent,
  cleanPrice,
} = require("../utils/helpers");

/**
 * Bug-hunting tests for AC Milan Store homepage .quick-buy component
 * Focus: personalization flow (name/number/player/patch) and cart consistency
 *
 * Key findings from manual review:
 * - BUG-1: Player name may be stored in cart item attributes/properties, not visible in page text
 * - BUG-2: Button is enabled with empty Tuo Nome, but clicking shows error below button (working as intended)
 * - BUG-3: Can add with name-only or number-only (missing validation for partial personalization)
 */

test.describe("Quick-Buy Personalization & Cart Bug Hunt", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissCookieConsent(page);
    await page.waitForLoadState("domcontentloaded");
    const quickBuy = page.locator(".quick-buy").first();
    await quickBuy.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  });

  async function goToCart(page) {
    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
  }

  test("BUG-001: Verify default size is pre-selected", async ({ page }) => {
    const quickBuy = page.locator(".quick-buy").first();
    const sizeSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Taglia" });

    const activeSizeBtn = sizeSection.locator("button.active").first();
    const activeSizeText = await activeSizeBtn.textContent().catch(() => null);
    console.log("Default selected size:", activeSizeText?.trim());

    const sizeBtns = await sizeSection.locator("button").all();
    for (const btn of sizeBtns) {
      const isActive = await btn.evaluate(el => el.classList.contains("active"));
      const isDisabled = await btn.isDisabled();
      const text = await btn.textContent();
      console.log(`Size ${text?.trim()}: active=${isActive}, disabled=${isDisabled}`);
    }

    await quickBuy.screenshot({ path: "screenshots/default-size-state.png" });
    expect(activeSizeText).toBeTruthy();
  });

  test("BUG-002: Giocatore - select player, add to cart, check cart item attributes", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    const sizeSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Taglia" });
    const selectedSize = await sizeSection.locator("button.active").first().textContent().catch(() => null);
    console.log("Size:", selectedSize?.trim());

    // Click Giocatore
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const giocatoreBtn = nameNumSection.locator("button:has-text('Giocatore')").first();
    await giocatoreBtn.click();
    await page.waitForTimeout(1500);

    // Select player from dropdown
    const playerSelect = quickBuy.locator("select").first();
    const selectVisible = await playerSelect.isVisible({ timeout: 2000 }).catch(() => false);
    console.log("Player select visible:", selectVisible);

    let selectedPlayer = null;
    if (selectVisible) {
      const options = await playerSelect.locator("option").all();
      console.log("Player options:", options.length);

      if (options.length > 1) {
        const secondOptionText = await options[1].textContent();
        selectedPlayer = secondOptionText?.trim();
        await playerSelect.selectOption({ index: 1 });
        console.log("Selected player:", selectedPlayer);
        await page.waitForTimeout(500);
      }
    }

    await quickBuy.screenshot({ path: "screenshots/giocatore-configured.png" });

    // Get price
    const priceEl = quickBuy.locator(".price-customization, .price, [class*='price']").first();
    const priceBeforeCart = await priceEl.textContent().catch(() => null);
    console.log("Price with Giocatore:", priceBeforeCart?.trim());

    // Add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    if (!(await addBtn.isDisabled())) {
      await addBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "screenshots/after-add-giocatore.png" });

      await goToCart(page);
      await page.screenshot({ path: "screenshots/cart-after-giocatore.png" });

      // Check cart page content for player name
      const cartContent = await page.locator("body").textContent();

      if (selectedPlayer && cartContent) {
        // Extract just the player name (remove number prefix like "2 - ")
        const playerName = selectedPlayer.replace(/^\d+\s*-\s*/, "");
        console.log("Looking for player name:", playerName);

        const playerInCart = cartContent.includes(selectedPlayer) || cartContent.includes(playerName);
        console.log("Player in cart text:", playerInCart);

        if (!playerInCart) {
          console.log("Player name not in cart page text. Checking cart item attributes/properties...");

          // Check for line item properties (Shopify stores customizations as line item properties)
          // Look for elements that might contain personalization data
          const cartItems = await page.locator(".cart-item, [data-cart-item], .cart__item, .cart-line-item, tr[class*='item']").all();
          console.log("Cart item elements:", cartItems.length);

          for (let i = 0; i < cartItems.length; i++) {
            const itemHtml = await cartItems[i].innerHTML();
            const itemText = await cartItems[i].textContent();
            console.log(`Cart item ${i} text:`, itemText?.trim().substring(0, 300));

            // Check for personalization attributes
            const hasPlayer = itemText?.includes(playerName) || itemText?.includes(selectedPlayer);
            const hasNome = itemText?.includes("Nome") || itemText?.includes("nome");
            const hasGiocatore = itemText?.includes("Giocatore") || itemText?.includes("giocatore");
            console.log(`Cart item ${i}: hasPlayer=${hasPlayer}, hasNome=${hasNome}, hasGiocatore=${hasGiocatore}`);

            // Check for data attributes
            const dataAttrs = await cartItems[i].evaluate(el => {
              const attrs = {};
              for (const attr of el.attributes) {
                if (attr.name.startsWith("data-")) {
                  attrs[attr.name] = attr.value;
                }
              }
              return attrs;
            });
            console.log(`Cart item ${i} data attributes:`, JSON.stringify(dataAttrs));
          }

          // Also check for hidden elements or line item properties
          const lineItemProps = await page.locator("[class*='line-item'], [class*='properties'], [class*='personalization'], [class*='customization'], dl, .item-properties").all();
          console.log("Line item property elements:", lineItemProps.length);

          for (let i = 0; i < lineItemProps.length; i++) {
            const text = await lineItemProps[i].textContent();
            console.log(`Line item prop ${i}:`, text?.trim().substring(0, 200));
          }

          // Check the full HTML of the cart for player name
          const fullHtml = await page.locator("body").innerHTML();
          const playerInHtml = fullHtml.includes(playerName) || fullHtml.includes(selectedPlayer);
          console.log("Player in full HTML:", playerInHtml);

          // Search for "Nome" or "Giocatore" in HTML
          const nomeInHtml = fullHtml.includes("Nome giocatore") || fullHtml.includes("nome_giocatore") || fullHtml.includes("NomeGiocatore");
          console.log("Nome/Giocatore keyword in HTML:", nomeInHtml);

          if (!playerInCart && !playerInHtml) {
            console.log("BUG: Player name not found anywhere in cart!");
            await page.screenshot({ path: "screenshots/BUG-player-not-in-cart.png" });
          }
        }
      }

      // Check size in cart
      if (selectedSize && cartContent) {
        const sizeInCart = cartContent.includes(selectedSize.trim());
        console.log("Size in cart:", sizeInCart);
      }
    }
  });

  test("BUG-003: Tuo Nome - add with empty fields shows error message", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    // Click Tuo Nome
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const tuoNomeBtn = nameNumSection.locator("button:has-text('Tuo Nome')").first();
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    // Don't fill anything
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    console.log("Add button disabled (empty Tuo Nome):", await addBtn.isDisabled());

    // Click add to cart with empty fields
    if (!(await addBtn.isDisabled())) {
      await addBtn.click();
      await page.waitForTimeout(2000);

      // Check for error message below button
      const errorMsg = quickBuy.locator(".error, .alert, .validation-message, [class*='error'], [class*='alert'], [class*='warning'], [class*='message']");
      const errorCount = await errorMsg.count();
      console.log("Error elements found:", errorCount);

      for (let i = 0; i < errorCount; i++) {
        const text = await errorMsg.nth(i).textContent();
        const visible = await errorMsg.nth(i).isVisible();
        console.log(`Error ${i}: text="${text?.trim()}", visible=${visible}`);
      }

      // Also check for any text that appeared near the button
      const quickBuyHtml = await quickBuy.innerHTML();
      const hasErrorText = quickBuyHtml.includes("error") || quickBuyHtml.includes("Error") || quickBuyHtml.includes("errore") || quickBuyHtml.includes("Errore") || quickBuyHtml.includes("compilare") || quickBuyHtml.includes("obbligatorio") || quickBuyHtml.includes("required");
      console.log("Error text in quick-buy HTML:", hasErrorText);

      await quickBuy.screenshot({ path: "screenshots/error-after-empty-add.png" });

      // Check if item was actually added to cart
      const cartLink = page.locator("a[href='/cart'], a[href*='cart']").first();
      const cartBadge = page.locator("[class*='cart-count'], [class*='cart-badge'], .cart-count, [data-cart-count]");
      const badgeText = await cartBadge.textContent().catch(() => null);
      console.log("Cart badge:", badgeText?.trim());
    }
  });

  test("BUG-004: Tuo Nome - add with name only (no number) - check cart", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    const sizeSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Taglia" });
    const selectedSize = await sizeSection.locator("button.active").first().textContent().catch(() => null);

    // Click Tuo Nome
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const tuoNomeBtn = nameNumSection.locator("button:has-text('Tuo Nome')").first();
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    // Fill ONLY name, leave number empty
    const nameInput = quickBuy.locator("input[placeholder='Nome']").first();
    const enteredName = "Rossi";
    await nameInput.fill(enteredName);
    console.log("Name:", enteredName, "| Number: (empty)");

    await quickBuy.screenshot({ path: "screenshots/name-only-filled.png" });

    // Try to add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    const isDisabled = await addBtn.isDisabled();
    console.log("Add button disabled (name only):", isDisabled);

    if (!isDisabled) {
      console.log("BUG: Can add to cart with name but no number!");
      await quickBuy.screenshot({ path: "screenshots/BUG-add-name-only.png" });

      await addBtn.click();
      await page.waitForTimeout(2000);

      // Check if error appeared
      const errorMsg = quickBuy.locator(".error, .alert, .validation-message, [class*='error'], [class*='alert']");
      const errorVisible = await errorMsg.first().isVisible({ timeout: 1000 }).catch(() => false);
      console.log("Error message shown:", errorVisible);

      if (!errorVisible) {
        // Item was added - check cart
        await goToCart(page);
        await page.screenshot({ path: "screenshots/cart-name-only.png" });

        const cartContent = await page.locator("body").textContent();
        const nameInCart = cartContent?.includes(enteredName);
        console.log("Name in cart:", nameInCart);

        if (nameInCart) {
          console.log("BUG CONFIRMED: Item added with name only, no number - incomplete personalization in cart");
          await page.screenshot({ path: "screenshots/BUG-name-only-in-cart.png" });
        }
      }
    }
  });

  test("BUG-005: Tuo Nome - add with number only (no name) - check cart", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    // Click Tuo Nome
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const tuoNomeBtn = nameNumSection.locator("button:has-text('Tuo Nome')").first();
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    // Fill ONLY number, leave name empty
    const numberInput = quickBuy.locator("input[placeholder='Numero']").first();
    const enteredNumber = "10";
    await numberInput.fill(enteredNumber);
    console.log("Name: (empty) | Number:", enteredNumber);

    await quickBuy.screenshot({ path: "screenshots/number-only-filled.png" });

    // Try to add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    const isDisabled = await addBtn.isDisabled();
    console.log("Add button disabled (number only):", isDisabled);

    if (!isDisabled) {
      console.log("BUG: Can add to cart with number but no name!");
      await quickBuy.screenshot({ path: "screenshots/BUG-add-number-only.png" });

      await addBtn.click();
      await page.waitForTimeout(2000);

      // Check if error appeared
      const errorMsg = quickBuy.locator(".error, .alert, .validation-message, [class*='error'], [class*='alert']");
      const errorVisible = await errorMsg.first().isVisible({ timeout: 1000 }).catch(() => false);
      console.log("Error message shown:", errorVisible);

      if (!errorVisible) {
        // Item was added - check cart
        await goToCart(page);
        await page.screenshot({ path: "screenshots/cart-number-only.png" });

        const cartContent = await page.locator("body").textContent();
        const numberInCart = cartContent?.includes(enteredNumber);
        console.log("Number in cart:", numberInCart);

        if (numberInCart) {
          console.log("BUG CONFIRMED: Item added with number only, no name - incomplete personalization in cart");
          await page.screenshot({ path: "screenshots/BUG-number-only-in-cart.png" });
        }
      }
    }
  });

  test("BUG-006: Tuo Nome - full flow (name + number + patch) - verify all in cart", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    const sizeSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Taglia" });
    const selectedSize = await sizeSection.locator("button.active").first().textContent().catch(() => null);
    console.log("Size:", selectedSize?.trim());

    // Tuo Nome
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const tuoNomeBtn = nameNumSection.locator("button:has-text('Tuo Nome')").first();
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    const nameInput = quickBuy.locator("input[placeholder='Nome']").first();
    const enteredName = "Rossi";
    await nameInput.fill(enteredName);

    const numberInput = quickBuy.locator("input[placeholder='Numero']").first();
    const enteredNumber = "7";
    await numberInput.fill(enteredNumber);

    // Patch SERIE A
    const patchSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Patch" });
    const serieABtn = patchSection.locator("button:has-text('SERIE A')").first();
    await serieABtn.click();
    await page.waitForTimeout(1000);

    const priceEl = quickBuy.locator(".price-customization, .price, [class*='price']").first();
    const finalPrice = await priceEl.textContent().catch(() => null);
    console.log("Final price:", finalPrice?.trim());

    await quickBuy.screenshot({ path: "screenshots/full-personalization.png" });

    // Add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    if (!(await addBtn.isDisabled())) {
      await addBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "screenshots/after-add-full.png" });

      await goToCart(page);
      await page.screenshot({ path: "screenshots/cart-full-personalization.png" });

      const cartContent = await page.locator("body").textContent();

      const checks = [
        { label: "Name", value: enteredName },
        { label: "Number", value: enteredNumber },
        { label: "Size", value: selectedSize?.trim() },
        { label: "Patch", value: "SERIE A" },
      ];

      for (const check of checks) {
        if (check.value && cartContent) {
          const inCart = cartContent.includes(check.value);
          console.log(`${check.label} (${check.value}) in cart:`, inCart);
          if (!inCart) {
            console.log(`BUG: ${check.label} not in cart!`);
            await page.screenshot({ path: `screenshots/BUG-${check.label.toLowerCase()}-missing-cart.png` });
          }
        }
      }

      // Also check cart item attributes/line item properties
      const cartItems = await page.locator(".cart-item, [data-cart-item], .cart__item, .cart-line-item, tr[class*='item']").all();
      for (let i = 0; i < cartItems.length; i++) {
        const itemText = await cartItems[i].textContent();
        console.log(`Cart item ${i} full text:`, itemText?.trim().substring(0, 500));
      }
    }
  });

  test("BUG-007: Giocatore - check cart item line item properties for player data", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    // Click Giocatore
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });
    const giocatoreBtn = nameNumSection.locator("button:has-text('Giocatore')").first();
    await giocatoreBtn.click();
    await page.waitForTimeout(1500);

    // Select player
    const playerSelect = quickBuy.locator("select").first();
    let selectedPlayer = null;
    if (await playerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await playerSelect.locator("option").all();
      if (options.length > 1) {
        selectedPlayer = (await options[1].textContent())?.trim();
        await playerSelect.selectOption({ index: 1 });
        console.log("Selected player:", selectedPlayer);
      }
    }

    // Add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    if (!(await addBtn.isDisabled())) {
      await addBtn.click();
      await page.waitForTimeout(3000);

      await goToCart(page);
      await page.screenshot({ path: "screenshots/cart-giocatore-detail.png" });

      // Deep inspection of cart HTML for line item properties
      const cartHtml = await page.locator("body").innerHTML();

      // Search for player-related data in HTML
      const playerName = selectedPlayer?.replace(/^\d+\s*-\s*/, "") || "";
      console.log("Searching for player:", playerName);

      // Check for Shopify line item properties format
      const propertyPatterns = [
        "Nome giocatore",
        "nome_giocatore",
        "NomeGiocatore",
        "Giocatore",
        "giocatore",
        playerName,
        selectedPlayer || "",
        "line-item-property",
        "line_item_property",
        "item-property",
        "personalization",
        "customization",
      ];

      for (const pattern of propertyPatterns) {
        if (pattern && cartHtml.includes(pattern)) {
          console.log(`Found pattern in cart HTML: "${pattern}"`);
        }
      }

      // Look for specific cart item detail elements
      const detailSelectors = [
        ".cart-item__details",
        ".cart__item-details",
        "[data-line-item-properties]",
        ".line-item-properties",
        ".item-properties",
        ".cart-item__property",
        "dl",
        "dt",
        "dd",
        "[class*='property']",
        "[class*='personalization']",
        "[class*='custom']",
      ];

      for (const sel of detailSelectors) {
        const els = await page.locator(sel).all();
        if (els.length > 0) {
          for (let i = 0; i < Math.min(els.length, 5); i++) {
            const text = await els[i].textContent();
            if (text?.trim()) {
              console.log(`Selector "${sel}" [${i}]:`, text.trim().substring(0, 200));
            }
          }
        }
      }
    }
  });

  test("BUG-008: Manica (sleeve) selection and price impact", async ({ page }) => {
    const quickBuy = page.locator(".quick-buy").first();
    const manicaSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Manica" });

    const manicaBtns = await manicaSection.locator("button").all();
    for (const btn of manicaBtns) {
      const isActive = await btn.evaluate(el => el.classList.contains("active"));
      const text = await btn.textContent();
      console.log(`Manica "${text?.trim()}": active=${isActive}`);
    }

    const priceEl = quickBuy.locator(".price-customization, .price, [class*='price']").first();
    const priceBefore = await priceEl.textContent().catch(() => null);
    console.log("Price before:", priceBefore?.trim());

    let activeSleeve = null;
    for (const btn of manicaBtns) {
      if (await btn.evaluate(el => el.classList.contains("active"))) {
        activeSleeve = await btn.textContent();
      }
    }

    for (const btn of manicaBtns) {
      const text = await btn.textContent();
      if (text?.trim() !== activeSleeve?.trim() && !(await btn.isDisabled())) {
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    const priceAfter = await priceEl.textContent().catch(() => null);
    console.log("Price after:", priceAfter?.trim());

    await quickBuy.screenshot({ path: "screenshots/manica-selection.png" });
  });

  test("BUG-009: Switch Giocatore/Tuo Nome - state reset", async ({ page }) => {
    const quickBuy = page.locator(".quick-buy").first();
    const nameNumSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Nome e Numero" });

    // Click Tuo Nome
    const tuoNomeBtn = nameNumSection.locator("button:has-text('Tuo Nome')").first();
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    const nameInput = quickBuy.locator("input[placeholder='Nome']").first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill("TestName");
      console.log("Filled name: TestName");
    }

    // Switch to Giocatore
    const giocatoreBtn = nameNumSection.locator("button:has-text('Giocatore')").first();
    await giocatoreBtn.click();
    await page.waitForTimeout(1500);

    const nameInputAfter = quickBuy.locator("input[placeholder='Nome']").first();
    const stillVisible = await nameInputAfter.isVisible({ timeout: 2000 }).catch(() => false);
    console.log("Name input still visible after switch:", stillVisible);

    // Switch back
    await tuoNomeBtn.click();
    await page.waitForTimeout(1500);

    const nameInputBack = quickBuy.locator("input[placeholder='Nome']").first();
    if (await nameInputBack.isVisible({ timeout: 2000 }).catch(() => false)) {
      const value = await nameInputBack.inputValue();
      console.log("Name value after switching back:", value);
      if (value === "") {
        console.log("Name was correctly reset after switching");
      }
    }

    await quickBuy.screenshot({ path: "screenshots/after-switch-back.png" });
  });

  test("BUG-010: Patch SERIE A - price update and cart", async ({ page }) => {
    test.setTimeout(60000);
    const quickBuy = page.locator(".quick-buy").first();

    const priceEl = quickBuy.locator(".price-customization, .price, [class*='price']").first();
    const basePrice = await priceEl.textContent().catch(() => null);
    console.log("Base price:", basePrice?.trim());

    const patchSection = quickBuy.locator(".product-customization__form-section-container").filter({ hasText: "Patch" });
    const serieABtn = patchSection.locator("button:has-text('SERIE A')").first();
    await serieABtn.click();
    await page.waitForTimeout(1000);

    const priceWithPatch = await priceEl.textContent().catch(() => null);
    console.log("Price with patch:", priceWithPatch?.trim());

    const diff = parseFloat(cleanPrice(priceWithPatch || "")) - parseFloat(cleanPrice(basePrice || ""));
    console.log("Price difference:", diff, "(expected: 12)");

    await quickBuy.screenshot({ path: "screenshots/patch-serie-a-selected.png" });

    // Add to cart
    const addBtn = quickBuy.locator("button:has-text('Aggiungi'), button:has-text('Add'), .add-to-cart, button[type='submit']").first();
    if (!(await addBtn.isDisabled())) {
      await addBtn.click();
      await page.waitForTimeout(3000);

      await goToCart(page);
      await page.screenshot({ path: "screenshots/cart-with-patch.png" });

      const cartContent = await page.locator("body").textContent();
      if (cartContent) {
        const patchInCart = cartContent.includes("SERIE A") || cartContent.includes("Serie A");
        console.log("SERIE A in cart:", patchInCart);
        if (!patchInCart) {
          console.log("BUG: SERIE A patch not in cart!");
          await page.screenshot({ path: "screenshots/BUG-patch-not-in-cart.png" });
        }
      }
    }
  });
});
