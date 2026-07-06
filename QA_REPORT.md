# QA Report: AC Milan Store - Quick Buy Personalization

**Test Date:** 2026-07-06  
**URL Tested:** https://store.acmilan.com/  
**Tester:** Automated Browser Testing (Playwright MCP)

---

## Executive Summary

Testing was performed on the AC Milan Store's quick-buy personalization feature (`.quick-buy` section) located on the homepage. The feature allows users to customize a jersey with player name/number and patches before adding to cart.

**Overall Status:** ⚠️ **ISSUES FOUND**

---

## Test Scenario

### Configuration Selected:

- **Product:** MAGLIA MILAN GARA HOME AUTHENTIC 2026/27
- **Size:** M
- **Personalization:** Giocatore (Player) - Rafa Leão #10 (+€15)
- **Patch:** SERIE A (+€12)
- **Expected Total:** €177.00 (€150 + €15 + €12)

---

## Bugs Found

### 🔴 BUG-001: Unwanted Free Item Automatically Added to Cart

**Severity:** HIGH  
**Location:** Cart dialog after adding personalized jersey  
**Description:** When adding a personalized jersey to the cart, an unwanted free item "MILAN BACK SPONSOR BIANCO BITPANDA - ADULTO - One Size" (€0.00) is automatically added without user selection or consent.

**Cart Contents Observed:**

1. MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 - Taglia: M - €150,00 ✅
2. **MILAN BACK SPONSOR BIANCO BITPANDA - ADULTO - One Size - €0,00** ❌ (NOT selected by user)
3. Prodotto personalizzazione maglia Giocatore - Numero: 10, Nome: Rafa Leão, Campionato: Serie A - €15,00 ✅
4. SERIE A - One Size - €12,00 ✅

**Impact:**

- Confusing user experience
- Potential inventory/order fulfillment issues
- May affect checkout process

**Steps to Reproduce:**

1. Navigate to https://store.acmilan.com/
2. Scroll to "DESIGN YOUR AC MILAN JERSEY" section
3. Select size M
4. Select "Giocatore" personalization
5. Select a player (e.g., Rafa Leão)
6. Select SERIE A patch
7. Click "Aggiungi al carrello"
8. Observe cart contents

---

### 🟡 BUG-002: JavaScript Console Error on Product Page

**Severity:** MEDIUM  
**Location:** Product detail page (https://store.acmilan.com/products/acm-home-authentic-jersey)  
**Error Message:**

```
TypeError: Cannot read properties of null (reading 'getAttribute')
    at https://store.acmilan.com/products/acm-home-authentic-jersey:5538:96
```

**Impact:**

- May affect functionality dependent on this script
- Poor code quality indicator
- Could cause issues in certain browsers

**Steps to Reproduce:**

1. Navigate to any product page
2. Open browser console
3. Observe error

---

### 🟡 BUG-003: Quick-Buy Form Resets After Adding to Cart

**Severity:** MEDIUM  
**Location:** Homepage quick-buy section  
**Description:** After successfully adding a personalized jersey to the cart, the quick-buy form completely resets:

- Price reverts to base price (€150.00)
- All selections (size, personalization, patch) are cleared
- User must reconfigure from scratch to add another item

**Impact:**

- Poor user experience for users wanting to add multiple items
- Inconvenient for users who want to modify their selection

**Expected Behavior:** Form should retain selections or provide option to "Add Another" with same configuration

---

## What Worked Correctly ✅

| Feature                | Status  | Notes                                           |
| ---------------------- | ------- | ----------------------------------------------- |
| Price Calculation      | ✅ PASS | €150 + €15 + €12 = €177.00 calculated correctly |
| Size Selection         | ✅ PASS | Size M correctly recorded in cart               |
| Player Personalization | ✅ PASS | Rafa Leão #10 correctly displayed in cart       |
| Patch Selection        | ✅ PASS | SERIE A patch correctly added                   |
| Cart Total             | ✅ PASS | Total €177.00 matches expected                  |
| HTTP Requests          | ✅ PASS | No 4xx/5xx errors detected                      |
| Form Interactions      | ✅ PASS | All buttons and dropdowns functional            |
| Preview Display        | ✅ PASS | Jersey preview showed name, number, and patch   |

---

## Technical Observations

### Console Messages

- **Errors:** 0 (after initial page load)
- **Warnings:** 4 (non-critical)

### Network Requests

- **HTTP 4xx/5xx Errors:** None detected
- **Failed Requests:** 2 image requests aborted (non-critical, likely lazy loading)

### Performance

- Page loaded successfully
- All interactive elements responded
- Cart dialog opened without delay

---

## UX Issues

1. **Form Reset After Add to Cart** - Users lose their configuration after adding to cart
2. **Unwanted Free Item** - Confusing to see an item in cart that wasn't selected
3. **No Confirmation Message** - No clear success message after adding to cart (only cart dialog opens)

---

## Recommendations

1. **Fix BUG-001 (HIGH PRIORITY):** Investigate why "MILAN BACK SPONSOR BIANCO BITPANDA" is being auto-added to cart. This appears to be a backend/cart logic issue.

2. **Fix BUG-002:** Resolve the null reference error in the product page JavaScript.

3. **Improve UX:** Consider retaining form selections after adding to cart, or provide a "Add Another" button.

4. **Add Success Feedback:** Display a clear success message when item is added to cart.

---

## Test Environment

- **Browser:** Chromium (via Playwright)
- **Viewport:** 1470x956
- **Location:** Italy (IT)
- **Currency:** EUR (€)
- **Language:** Italian

---

## Conclusion

The quick-buy personalization feature is **functionally working** for the core use case (selecting options and adding to cart). However, there are **3 bugs** that need attention:

1. **Critical:** Unwanted free item being added to cart
2. **Medium:** JavaScript console error
3. **Medium:** Form reset after adding to cart

The price calculation and cart total are accurate, and all form interactions work as expected.
