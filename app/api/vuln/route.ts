// app/api/vuln/route.ts

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
const SECRET_KEY = process.env.JWT_SECRET; // Ensure this is set in env

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("token");

    if (!tokenCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = tokenCookie.value;

    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);

    // Ensure payload contains a valid user
    if (!payload || !payload.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const vuln = await prisma.vulnerability.findMany();

    return NextResponse.json(vuln);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
