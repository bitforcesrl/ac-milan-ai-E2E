# QA Report: AC Milan Store - PDP (Product Detail Page) Personalization

**Test Date:** 2026-07-06  
**URL Tested:** https://store.acmilan.com/products/acm-home-authentic-jersey  
**Tester:** Automated Browser Testing (Playwright MCP)

---

## Executive Summary

Testing was performed on the AC Milan Store's Product Detail Page (PDP) personalization feature. This test focused on the "Tuo Nome" (custom name and number) personalization option with a different size selection (L instead of M from previous test).

**Overall Status:** ⚠️ **ISSUES FOUND**

---

## Test Scenario

### Configuration Selected:

- **Product:** MAGLIA MILAN GARA HOME AUTHENTIC 2026/27
- **Size:** L (changed from M in previous test)
- **Personalization:** Tuo Nome (Custom Name) - "TEST" #99 (+€18)
- **Patch:** SERIE A (+€12)
- **Expected Total:** €180.00 (€150 + €18 + €12)

---

## Bugs Found

### 🔴 BUG-001: Unwanted Free Item Automatically Added to Cart

**Severity:** HIGH  
**Location:** Cart dialog after adding personalized jersey from PDP  
**Description:** When adding a personalized jersey to the cart from the PDP, an unwanted free item "MILAN BACK SPONSOR BIANCO BITPANDA - ADULTO - One Size" (€0.00) is automatically added without user selection or consent.

**Cart Contents Observed:**

1. MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 - Taglia: L - €150,00 ✅
2. **MILAN BACK SPONSOR BIANCO BITPANDA - ADULTO - One Size - €0,00** ❌ (NOT selected by user)
3. Prodotto personalizzazione maglia - Numero: 99, Nome: TEST, Campionato: Serie A - €18,00 ✅
4. SERIE A - One Size - €12,00 ✅

**Impact:**

- Confusing user experience
- Potential inventory/order fulfillment issues
- May affect checkout process
- **Same bug present in both quickbuy and PDP flows**
- **Confirmed with different size (L) and different personalization type (Tuo Nome)**

**Steps to Reproduce:**

1. Navigate to https://store.acmilan.com/products/acm-home-authentic-jersey
2. Select size L
3. Select "Tuo Nome" personalization
4. Enter custom name (e.g., "TEST") and number (e.g., "99")
5. Select SERIE A patch
6. Click "Aggiungi al carrello"
7. Observe cart contents

---

### 🟡 BUG-002: JavaScript Console Error on PDP

**Severity:** MEDIUM  
**Location:** Product detail page  
**Error Message:**

```
TypeError: Cannot read properties of null (reading 'getAttribute')
    at https://store.acmilan.com/products/acm-home-authentic-jersey:5995:96
```

**Impact:**

- May affect functionality dependent on this script
- Poor code quality indicator
- Could cause issues in certain browsers
- **Same error present on all product pages**
- **Persists across different personalization flows**

**Steps to Reproduce:**

1. Navigate to any product page
2. Open browser console
3. Observe error

---

### 🟡 BUG-003: Rossoneri Rewards Points Not Updated with Personalization

**Severity:** MEDIUM  
**Location:** PDP rewards section  
**Description:** The Rossoneri Rewards points display shows "Ottieni 150 punti" even after adding personalization options that increase the total price to €180. The points should reflect the final price (180 points), not the base price (150 points).

**Expected:** "Ottieni 180 punti per questo prodotto con Rossoneri Rewards"  
**Actual:** "Ottieni 150 punti per questo prodotto con Rossoneri Rewards"

**Impact:**

- Misleading information about rewards points
- Customer may not understand actual points earned
- **Same bug present in previous test with Giocatore personalization**
- **Confirmed with Tuo Nome personalization (€180 total)**

**Steps to Reproduce:**

1. Navigate to https://store.acmilan.com/products/acm-home-authentic-jersey
2. Select size L
3. Select "Tuo Nome" personalization (+€18)
4. Enter name and number
5. Select SERIE A patch (+€12)
6. Observe rewards points display (still shows 150 instead of 180)

---

## What Worked

### ✅ Size Selection

- Size L button was clickable and responsive
- URL updated correctly with variant parameter: `?variant=57203561496949`
- Size selection was visually highlighted
- All sizes (XS, S, M, L, XL, XXL) were available and clickable

### ✅ Tuo Nome Personalization

- "Tuo Nome (+ €18)" button was clickable and activated correctly
- Price updated immediately from €150 to €168 after selection
- Input fields for "Nome" and "Numero" appeared correctly
- Character counters worked properly (4/10 for name, 2/2 for number)
- Input validation prevented exceeding character limits

### ✅ Patch Selection

- "SERIE A (+ €12)" button was clickable
- Price updated correctly from €168 to €180 after patch selection
- Patch appeared in the preview overlay on the product image

### ✅ Price Calculation

- Base price: €150.00
- Tuo Nome personalization: +€18.00
- SERIE A patch: +€12.00
- **Total: €180.00** ✅ CORRECT

### ✅ Preview Functionality

- Preview updated in real-time as personalization was added
- Custom name "TEST" appeared letter-by-letter on the jersey back
- Number "99" appeared correctly below the name
- SERIE A patch appeared in the preview
- Preview was visible both in the main image area and in the thumbnail

### ✅ Cart Addition

- "Aggiungi al carrello" button was responsive
- Cart dialog opened automatically after clicking
- Correct product added with all personalization details
- Size L correctly reflected in cart
- Custom name "TEST" and number "99" correctly displayed
- SERIE A patch correctly included
- Individual line item prices were correct

---

## PDP vs Quick-Buy Comparison

Both flows exhibit the same bugs:

| Feature                    | PDP        | Quick-Buy  |
| -------------------------- | ---------- | ---------- |
| Unwanted free item         | ❌ Present | ❌ Present |
| JS console error           | ❌ Present | ❌ Present |
| Rewards points not updated | ❌ Present | ❌ Present |
| Price calculation          | ✅ Correct | ✅ Correct |
| Personalization flow       | ✅ Works   | ✅ Works   |
| Cart addition              | ✅ Works   | ✅ Works   |

**Conclusion:** The bugs are systemic and affect both purchase flows, suggesting they originate from shared backend/cart logic rather than flow-specific code.

---

## Technical Observations

### Console Errors

- **1 JavaScript error** present on page load (BUG-002)
- **3 warnings** present (non-critical)
- Error persists throughout the personalization flow
- Error occurs at line 5995 in the page script

### Network Requests

- No failed HTTP requests observed
- All personalization updates triggered successful API calls
- Cart addition completed successfully

### Performance

- Page loaded quickly
- Personalization updates were responsive
- Preview updates were smooth and real-time
- Cart dialog opened without delay

---

## UX Issues

### 🟡 UX-001: Rewards Points Display Misleading

**Location:** PDP rewards section  
**Issue:** Points display does not update with personalization, showing base price points instead of final price points  
**Impact:** Customers may feel misled about rewards earned

### 🟢 UX-002: No Visual Feedback on Cart Addition

**Location:** After clicking "Aggiungi al carrello"  
**Issue:** While cart dialog opens, there's no success message or animation confirming the action  
**Impact:** Minor - cart dialog opening provides sufficient feedback

### ✅ UX-003: Character Counters Helpful

**Location:** Tuo Nome input fields  
**Issue:** N/A - This is a positive observation  
**Impact:** Character counters (4/10, 2/2) help users understand input limits

---

## Recommendations

### Priority 1: Fix Unwanted Free Item Bug (BUG-001)

**Root Cause Hypothesis:** Cart logic automatically adds a promotional item without checking user consent or promotional eligibility.

**Suggested Fix:**

- Review cart addition logic in backend
- Add conditional check for promotional item eligibility
- Ensure promotional items are only added when explicitly selected or when promotion criteria are met
- Test both PDP and quick-buy flows after fix

### Priority 2: Fix Rewards Points Display (BUG-003)

**Root Cause Hypothesis:** Rewards points calculation uses base product price instead of final personalized price.

**Suggested Fix:**

- Update rewards points calculation to use final price including personalization
- Trigger points recalculation when personalization options change
- Display updated points in real-time

### Priority 3: Fix JavaScript Error (BUG-002)

**Root Cause Hypothesis:** Script attempts to access DOM element that doesn't exist or hasn't loaded.

**Suggested Fix:**

- Add null check before calling `getAttribute()`
- Review script at line 5995 for proper DOM element validation
- Test across different browsers to ensure compatibility

---

## Test Checklist

### Page Elements

- [x] Product title visible
- [x] Base price correct (€150)
- [x] Image gallery functional (13 images)
- [x] Size selector present and functional
- [x] Personalization section visible
- [x] Add to cart button active

### Size Selection

- [x] Available sizes clickable (XS, S, M, L, XL, XXL)
- [x] URL updates with variant parameter
- [x] Selection visually highlighted

### Tuo Nome Personalization

- [x] "Tuo Nome" button clickable
- [x] Price updates (+€18)
- [x] Input fields appear
- [x] Character counters functional
- [x] Input validation working

### Patch Selection

- [x] Patch button clickable
- [x] Price updates (+€12)
- [x] Patch appears in preview
- [x] Active state visible

### Price and Cart

- [x] Total price calculated correctly (€180)
- [x] Add to cart functional
- [x] Cart contents correct (except unwanted item)
- [x] Size correct in cart (L)
- [x] Personalization correct in cart (TEST #99, SERIE A)
- [ ] **No unwanted items in cart** ❌ FAILED

### Rewards and Feedback

- [ ] Rewards points updated correctly ❌ FAILED (shows 150 instead of 180)
- [x] Visual feedback after addition (cart dialog opens)
- [ ] Confirmation message visible ❌ PARTIAL (no explicit success message)

---

## Conclusion

The PDP personalization flow with "Tuo Nome" option works correctly for the core functionality: size selection, custom name/number input, patch selection, price calculation, and cart addition all function as expected.

However, **three bugs persist** from previous testing:

1. **HIGH severity:** Unwanted free item automatically added to cart
2. **MEDIUM severity:** Rewards points not updated with personalization
3. **MEDIUM severity:** JavaScript console error on page load

These bugs are consistent across both PDP and quick-buy flows, indicating systemic issues that require backend fixes. The unwanted free item bug is the most critical as it affects order accuracy and customer experience.

**Recommendation:** Prioritize fixing BUG-001 (unwanted free item) as it has the highest impact on customer experience and order fulfillment.
