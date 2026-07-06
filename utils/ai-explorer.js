/**
 * AI-driven exploratory testing utilities
 * Architecture: GPT analyzes page state → decides action → Playwright executes → repeat
 */

const fs = require("fs");
const path = require("path");

/**
 * Capture current page state (screenshot + simplified DOM)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} screenshotPath - Path to save screenshot
 * @returns {Promise<{screenshot: string, dom: string, url: string, title: string}>}
 */
async function capturePageState(page, screenshotPath) {
  // Take screenshot
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const screenshotBase64 = fs.readFileSync(screenshotPath).toString("base64");

  // Extract simplified DOM structure
  const dom = await page.evaluate(() => {
    function simplifyDOM(element, depth = 0) {
      if (depth > 5) return ""; // Limit depth

      const tag = element.tagName?.toLowerCase() || "";
      const id = element.id ? `#${element.id}` : "";
      const classes =
        element.className && typeof element.className === "string"
          ? "." +
            element.className
              .split(" ")
              .filter((c) => c)
              .slice(0, 3)
              .join(".")
          : "";

      // Get relevant attributes
      const attrs = [];
      if (element.getAttribute) {
        const type = element.getAttribute("type");
        const placeholder = element.getAttribute("placeholder");
        const name = element.getAttribute("name");
        const role = element.getAttribute("role");
        const ariaLabel = element.getAttribute("aria-label");

        if (type) attrs.push(`type="${type}"`);
        if (placeholder) attrs.push(`placeholder="${placeholder}"`);
        if (name) attrs.push(`name="${name}"`);
        if (role) attrs.push(`role="${role}"`);
        if (ariaLabel) attrs.push(`aria-label="${ariaLabel}"`);
      }

      const attrStr = attrs.length ? " " + attrs.join(" ") : "";
      const indent = "  ".repeat(depth);

      // Get text content (truncated)
      let text = "";
      if (element.childNodes) {
        for (const child of element.childNodes) {
          if (child.nodeType === 3) {
            // Text node
            const t = child.textContent?.trim();
            if (t && t.length < 100) {
              text = t;
              break;
            }
          }
        }
      }

      const textStr = text ? ` "${text.substring(0, 50)}"` : "";

      let result = `${indent}<${tag}${id}${classes}${attrStr}>${textStr}\n`;

      // Process children (limit to first 10)
      if (element.children) {
        const children = Array.from(element.children).slice(0, 10);
        for (const child of children) {
          result += simplifyDOM(child, depth + 1);
        }
      }

      return result;
    }

    // Focus on main content areas
    const main =
      document.querySelector('main, .main, #main, [role="main"]') ||
      document.body;
    return simplifyDOM(main);
  });

  const url = page.url();
  const title = await page.title();

  return {
    screenshot: screenshotBase64,
    screenshotPath,
    dom,
    url,
    title,
  };
}

/**
 * Available actions that GPT can choose from
 */
const AVAILABLE_ACTIONS = {
  CLICK: "click",
  FILL: "fill",
  SELECT: "select",
  WAIT: "wait",
  SCROLL: "scroll",
  PRESS_KEY: "press_key",
  HOVER: "hover",
  DONE: "done", // Test completed
  FAIL: "fail", // Test failed
};

/**
 * Parse GPT response to extract action
 * @param {string} gptResponse - Raw GPT response
 * @returns {{action: string, selector?: string, value?: string, reason: string}}
 */
function parseGPTResponse(gptResponse) {
  try {
    // Try to parse as JSON first
    const jsonMatch = gptResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || AVAILABLE_ACTIONS.WAIT,
        selector: parsed.selector,
        value: parsed.value,
        reason: parsed.reason || "No reason provided",
      };
    }

    // Fallback: parse text format
    const lines = gptResponse.split("\n");
    const result = { action: AVAILABLE_ACTIONS.WAIT, reason: gptResponse };

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("action:")) {
        const action = line.split(":")[1]?.trim().toLowerCase();
        if (Object.values(AVAILABLE_ACTIONS).includes(action)) {
          result.action = action;
        }
      }
      if (lower.includes("selector:")) {
        result.selector = line.split(":")[1]?.trim();
      }
      if (lower.includes("value:")) {
        result.value = line.split(":")[1]?.trim();
      }
      if (lower.includes("reason:")) {
        result.reason = line.split(":")[1]?.trim();
      }
    }

    return result;
  } catch (e) {
    return {
      action: AVAILABLE_ACTIONS.WAIT,
      reason: `Parse error: ${e.message}`,
    };
  }
}

/**
 * Execute an action based on GPT's decision
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {{action: string, selector?: string, value?: string}} actionDef - Action to execute
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeAction(page, actionDef) {
  try {
    switch (actionDef.action) {
      case AVAILABLE_ACTIONS.CLICK:
        if (!actionDef.selector) {
          return { success: false, message: "Click action requires selector" };
        }
        await page.locator(actionDef.selector).first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        return { success: true, message: `Clicked: ${actionDef.selector}` };

      case AVAILABLE_ACTIONS.FILL:
        if (!actionDef.selector || actionDef.value === undefined) {
          return {
            success: false,
            message: "Fill action requires selector and value",
          };
        }
        await page.locator(actionDef.selector).first().fill(actionDef.value);
        await page.waitForTimeout(500);
        return {
          success: true,
          message: `Filled ${actionDef.selector} with "${actionDef.value}"`,
        };

      case AVAILABLE_ACTIONS.SELECT:
        if (!actionDef.selector || actionDef.value === undefined) {
          return {
            success: false,
            message: "Select action requires selector and value",
          };
        }
        await page
          .locator(actionDef.selector)
          .first()
          .selectOption(actionDef.value);
        await page.waitForTimeout(500);
        return {
          success: true,
          message: `Selected ${actionDef.value} in ${actionDef.selector}`,
        };

      case AVAILABLE_ACTIONS.WAIT:
        await page.waitForTimeout(2000);
        return { success: true, message: "Waited 2 seconds" };

      case AVAILABLE_ACTIONS.SCROLL:
        if (actionDef.selector) {
          await page
            .locator(actionDef.selector)
            .first()
            .scrollIntoViewIfNeeded();
        } else {
          await page.evaluate(() => window.scrollBy(0, 300));
        }
        await page.waitForTimeout(500);
        return {
          success: true,
          message: `Scrolled${actionDef.selector ? " to " + actionDef.selector : ""}`,
        };

      case AVAILABLE_ACTIONS.PRESS_KEY:
        if (!actionDef.value) {
          return {
            success: false,
            message: "Press key action requires value (key name)",
          };
        }
        await page.keyboard.press(actionDef.value);
        await page.waitForTimeout(500);
        return { success: true, message: `Pressed key: ${actionDef.value}` };

      case AVAILABLE_ACTIONS.HOVER:
        if (!actionDef.selector) {
          return { success: false, message: "Hover action requires selector" };
        }
        await page.locator(actionDef.selector).first().hover();
        await page.waitForTimeout(500);
        return { success: true, message: `Hovered: ${actionDef.selector}` };

      case AVAILABLE_ACTIONS.DONE:
        return { success: true, message: "Test completed successfully" };

      case AVAILABLE_ACTIONS.FAIL:
        return {
          success: false,
          message: `Test failed: ${actionDef.value || "Unknown reason"}`,
        };

      default:
        return {
          success: false,
          message: `Unknown action: ${actionDef.action}`,
        };
    }
  } catch (error) {
    return { success: false, message: `Action failed: ${error.message}` };
  }
}

/**
 * Build prompt for GPT to decide next action
 * @param {Object} pageState - Current page state
 * @param {string} testGoal - What we're trying to test
 * @param {Array} history - Previous actions taken
 * @returns {string}
 */
function buildPrompt(pageState, testGoal, history) {
  const historyStr =
    history.length > 0
      ? "\nPrevious actions:\n" +
        history.map((h, i) => `${i + 1}. ${h.action}: ${h.reason}`).join("\n")
      : "";

  return `You are testing an e-commerce website (AC Milan Store). Your goal is: ${testGoal}

Current page state:
- URL: ${pageState.url}
- Title: ${pageState.title}

Simplified DOM structure:
\`\`\`
${pageState.dom.substring(0, 3000)}
\`\`\`

${historyStr}

Look at the screenshot and DOM above. Decide the NEXT SINGLE ACTION to take.

Available actions:
- click: Click an element (provide CSS selector)
- fill: Fill an input field (provide selector and value)
- select: Select dropdown option (provide selector and value/index)
- wait: Wait for page to load
- scroll: Scroll down or to an element
- press_key: Press a keyboard key (e.g., "Escape", "Enter")
- hover: Hover over an element
- done: Test goal achieved
- fail: Test cannot proceed (explain why)

Respond in JSON format:
{
  "action": "click|fill|select|wait|scroll|press_key|hover|done|fail",
  "selector": "CSS selector (if needed)",
  "value": "value to fill/select/key to press (if needed)",
  "reason": "Why you chose this action"
}

Be specific with selectors. Use text content, classes, or data attributes visible in the DOM.
If you see a cookie consent banner, dismiss it first.
If you see overlays/modals blocking interaction, close them with Escape key.
`;
}

/**
 * Main exploratory test loop
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} options.goal - Test goal description
 * @param {Function} options.getGPTDecision - Function that takes prompt+screenshot and returns GPT response
 * @param {number} options.maxSteps - Maximum number of steps (default: 20)
 * @param {string} options.screenshotDir - Directory for screenshots
 * @returns {Promise<{success: boolean, steps: Array, finalState: Object}>}
 */
async function exploratoryTest(page, options) {
  const {
    goal,
    getGPTDecision,
    maxSteps = 20,
    screenshotDir = "screenshots",
  } = options;

  // Ensure screenshot directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const history = [];
  let step = 0;
  let success = false;

  console.log(`\n🧪 Starting exploratory test: ${goal}\n`);

  while (step < maxSteps) {
    step++;
    console.log(`\n--- Step ${step}/${maxSteps} ---`);

    // Capture current state
    const screenshotPath = path.join(
      screenshotDir,
      `exploratory-step-${step}.png`,
    );
    const pageState = await capturePageState(page, screenshotPath);

    console.log(`📍 URL: ${pageState.url}`);
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Build prompt and get GPT decision
    const prompt = buildPrompt(pageState, goal, history);
    console.log("🤖 Asking GPT for next action...");

    const gptResponse = await getGPTDecision(prompt, screenshotPath);
    const actionDef = parseGPTResponse(gptResponse);

    console.log(`🎯 Action: ${actionDef.action}`);
    console.log(`💭 Reason: ${actionDef.reason}`);
    if (actionDef.selector) console.log(`🎯 Selector: ${actionDef.selector}`);
    if (actionDef.value) console.log(`📝 Value: ${actionDef.value}`);

    // Check for terminal states
    if (actionDef.action === AVAILABLE_ACTIONS.DONE) {
      console.log("✅ Test completed successfully!");
      success = true;
      break;
    }

    if (actionDef.action === AVAILABLE_ACTIONS.FAIL) {
      console.log(`❌ Test failed: ${actionDef.reason}`);
      break;
    }

    // Execute action
    const result = await executeAction(page, actionDef);
    console.log(`📊 Result: ${result.success ? "✓" : "✗"} ${result.message}`);

    // Add to history
    history.push({
      step,
      action: actionDef.action,
      selector: actionDef.selector,
      value: actionDef.value,
      reason: actionDef.reason,
      success: result.success,
    });

    if (!result.success) {
      console.log("⚠️ Action failed, continuing...");
    }

    // Small delay between steps
    await page.waitForTimeout(500);
  }

  if (step >= maxSteps && !success) {
    console.log(
      `\n⚠️ Reached maximum steps (${maxSteps}) without completing goal`,
    );
  }

  // Capture final state
  const finalScreenshot = path.join(screenshotDir, "exploratory-final.png");
  const finalState = await capturePageState(page, finalScreenshot);

  return {
    success,
    steps: history,
    finalState,
    totalSteps: step,
  };
}

module.exports = {
  capturePageState,
  parseGPTResponse,
  executeAction,
  buildPrompt,
  exploratoryTest,
  AVAILABLE_ACTIONS,
};
