// api/auth/user/route.ts
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET; // Use an environment variable in production

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

    return Response.json({
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    });
  } catch (error) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
}
