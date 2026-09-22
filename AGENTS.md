
> Questo file contiene le istruzioni per lo sviluppo dell'app Next.js
> Se ti viene richiesto di eseguire test E2E manuali, segui le istruzioni nel file [`AGENTS.e2e.md`](AGENTS.e2e.md), e non seguire altre guide o documentazioni.

# AGENT.md - Guidelines for Next.js App Router Project

## 🎯 Role & Objective
You are an expert full-stack developer specialized in React, TypeScript, Next.js (App Router), and modern web standards. Your goal is to write clean, type-safe, performant, and maintainable code adhering strictly to the architectural patterns defined below.

---

## 🛠️ Tech Stack & Conventions
- **Framework:** Next.js (App Router, Server Components by default)
- **Language:** TypeScript (Strict mode enabled)
- **Styling:** Tailwind CSS (or CSS Modules)
- **State Management:** React Hooks, Server State (React Query / Server Actions), Context (only when strictly necessary)
- **UI Components:** Shadcn UI / Radix Primitives

---

## 📐 Core Architectural Rules

### 1. Server Components vs. Client Components
- **Default to React Server Components (RSC):** Every component inside `app/` is a Server Component unless specified otherwise.
- **Client Components (`'use client'`):**
  - Use ONLY when requiring interactivity (`useState`, `useEffect`, event listeners) or browser APIs.
  - Keep Client Components at the leaf nodes of the component tree to maximize server rendering benefits.
  - Do NOT wrap entire pages in `'use client'`.

### 2. Data Fetching & Server Actions
- **Data Fetching:**
  - Fetch data directly inside Server Components using `async/await`.
  - Prefer native `fetch()` with Next.js caching/revalidation options (`{ next: { revalidate: 60 } }`).
- **Server Actions:**
  - Use Server Actions for data mutations (POST, PUT, DELETE).
  - Define Server Actions in a dedicated file (e.g., `lib/actions/user.actions.ts`) or marked with `'use server'` at the top of the function/file.
  - Always validate input data using **Zod** before processing inside Server Actions.

### 3. File & Directory Structure
Follow the standard Next.js App Router structure:

src/
├── app/                  # App router pages and layouts
│   ├── (auth)/           # Route group for auth pages
│   ├── api/              # API Route Handlers (if Server Actions aren't enough)
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # Reusable UI components
│   ├── ui/               # Generic base UI (atoms/primitives like Button, Input)
│   └── shared/           # Business-specific shared components (Header, Sidebar)
├── lib/                  # Utilities, database clients, validation schemas
│   ├── actions/          # Server Actions
│   ├── validations/      # Zod schemas
│   └── utils.ts          # Helper functions (cn, formatters)
├── types/                # Global TypeScript definitions
└── constants/            # Constants, navigation links, site metadata

### 4. TypeScript & Code Style
- **Strict Types:** Avoid `any` at all costs. Define precise interfaces or type aliases for props and API responses.
- **Imports:** Use absolute path aliases (`@/components/...`, `@/lib/...`).
- **Naming Conventions:**
  - Components: `PascalCase.tsx`
  - Helpers/Utilities/Hooks: `camelCase.ts`
  - Server Actions / API Routes: `kebab-case.ts` or `domain.actions.ts`

### 5. Form Handling & Validation
- Use **React Hook Form** combined with **Zod** schema validation via `@hookform/resolvers`.
- Always share Zod schemas between client-side form validation and server-side action validation.

---

## 🚫 What NOT to Do
- **Do NOT** use `pages/` directory routing patterns (e.g., `getServerSideProps`, `getStaticProps`).
- **Do NOT** import server-only modules (like database clients) into Client Components.
- **Do NOT** use `useEffect` for data fetching; use Server Components or React Query.
- **Do NOT** write inline styles; rely on Tailwind CSS classes.

---

## ⚡ Workflow Expectations for AI Agent
1. **Context First:** Before editing, inspect existing schemas, types, and utilities to avoid duplication.
2. **Minimal Changes:** Modify only the files relevant to the current task.
3. **Type Checking:** Ensure no TypeScript errors or missing imports are introduced in modified code.
4. **Error Handling:** Always wrap Server Actions and external APIs in `try/catch` blocks and return structured success/error objects.