/**
 * Autenticazione semplice basata su password (da env) + cookie di sessione firmato (HMAC-SHA256).
 * Il cookie contiene: <scadenzaEpochMs>.<firma> — nessun dato sensibile, la firma
 * impedisce la falsificazione della scadenza.
 */

export const SESSION_COOKIE_NAME = "app_session";
export const LOGIN_PATH = "/login";

/** Durata della sessione in ore (default: 7 giorni) */
export const SESSION_TTL_HOURS = Number(process.env.APP_SESSION_TTL_HOURS ?? 168);

function getSecret(): string {
    const secret = process.env.APP_SESSION_SECRET;
    if (!secret) {
        throw new Error("APP_SESSION_SECRET non è impostata nelle variabili d'ambiente");
    }
    return secret;
}

function getPassword(): string {
    const password = process.env.APP_PASSWORD;
    if (!password) {
        throw new Error("APP_PASSWORD non è impostata nelle variabili d'ambiente");
    }
    return password;
}

async function hmac(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(getSecret()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/** Costante-time comparison per evitare timing attacks */
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/** Verifica la password inserita dall'utente */
export async function verifyPassword(input: string): Promise<boolean> {
    const expected = getPassword();
    const encoder = new TextEncoder();
    const inputHash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input))),
    )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const expectedHash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(expected))),
    )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return safeEqual(inputHash, expectedHash);
}

/** Genera il valore del cookie di sessione firmato */
export async function createSessionToken(): Promise<string> {
    const expiresAt = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;
    const signature = await hmac(String(expiresAt));
    return `${expiresAt}.${signature}`;
}

/** Verifica la validità del token di sessione (firma + scadenza) */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const separatorIndex = token.indexOf(".");
    if (separatorIndex === -1) return false;

    const expiresAt = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    if (!/^\d+$/.test(expiresAt)) return false;

    const expectedSignature = await hmac(expiresAt);
    if (!safeEqual(signature, expectedSignature)) return false;

    return Number(expiresAt) > Date.now();
}