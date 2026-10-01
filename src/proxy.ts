import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // La pagina di login è sempre accessibile
    if (pathname.startsWith(LOGIN_PATH)) {
        return NextResponse.next();
    }

    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = await verifySessionToken(sessionToken);

    if (isAuthenticated) {
        return NextResponse.next();
    }

    // Per le chiamate API rispondiamo con 401 invece di un redirect
    if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        // Protegge tutto tranne asset statici e la pagina di login
        "/((?!_next/static|_next/image|favicon.ico|login).*)",
    ],
};