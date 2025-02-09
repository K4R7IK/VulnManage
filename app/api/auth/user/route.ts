import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma"; // Import Prisma client

const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("token"); // JWT stored as 'token' cookie

    if (!tokenCookie) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = tokenCookie.value;

    // Verify the JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Fetch user from the database to get full details (including companyId)
    const user = await prisma.user.findUnique({
      where: { email: payload.email }, // Assuming email is stored in JWT
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true, // Fetch associated companyId
      },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error("Auth Error:", error);
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
