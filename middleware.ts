// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "./lib/session";

function handleUnauthorized(req: NextRequest) {
  const loginURL = new URL("/login", req.url);
  loginURL.searchParams.set("callbackURL", req.nextUrl.pathname);
  return NextResponse.redirect(loginURL);
}

export default async function middleware(req: NextRequest) {
  // Checking if route is protected
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  const token = req.cookies.get("token")?.value;

  if (!token) {
    return handleUnauthorized(req);
  }

  try {
    const payload = await decrypt(token);

    if (!payload || !payload.id) {
      return handleUnauthorized(req);
    }
    return NextResponse.next();
  } catch (error) {
    console.error("Token verification failed", error);
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("token");
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
