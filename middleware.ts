// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export async function middleware(req: NextRequest) {
  // Exclude static files and API routes if they're under /dashboard
  if (
    req.nextUrl.pathname.startsWith("/_next") ||
    req.nextUrl.pathname.startsWith("/static") ||
    req.nextUrl.pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;

  // Create login redirect response
  const handleUnauthorized = () => {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!token) {
    return handleUnauthorized();
  }

  try {
    // Verify token using jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Add user info to request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", payload.role as string);

    // Continue with added headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("Middleware error:", error);
    return handleUnauthorized();
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
