import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto"; // For token generation
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("token");

    if (!tokenCookie) {
      return {
        authenticated: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const token = tokenCookie.value;
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload || !payload.email) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Invalid token" },
          { status: 401 },
        ),
      };
    }

    return { authenticated: true, user: payload };
  } catch (_) {
    // Renamed error parameter to _ since it's not used
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}

// Admin generates an invite token
export async function POST(req: Request) {
  const auth = await verifyAuth();
  if (!auth.authenticated) return auth.response;

  const { email, companyId } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Generate a secure token
  const token = crypto.randomBytes(32).toString("hex");

  try {
    const newToken = await prisma.registerToken.create({
      data: {
        email,
        token,
        companyId: Number(companyId) ?? null,
      },
    });

    return NextResponse.json({ token: newToken.token });
  } catch (_) {
    // Renamed error parameter to _ since it's not used
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 },
    );
  }
}
