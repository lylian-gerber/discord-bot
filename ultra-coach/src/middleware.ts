import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/signup"];

/** Filtre grossier (présence du cookie). La vraie vérification de session se fait côté serveur. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("uc_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|manifest.webmanifest).*)"],
};
