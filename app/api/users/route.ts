import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const SECRET_KEY = process.env.JWT_SECRET; // Ensure this is set in .env

// Middleware to verify authentication
async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("token");

    if (!tokenCookie) {
      return { authenticated: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const token = tokenCookie.value;
    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);

    if (!payload || !payload.email) {
      return { authenticated: false, response: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
    }

    return { authenticated: true, user: payload };
  } catch (error) {
    return { authenticated: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

// Fetch all users (GET)
export async function GET() {
  const auth = await verifyAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create a new user (POST)
export async function POST(req: Request) {
  const auth = await verifyAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { name, email, password, role, companyId } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password, // Ensure this is hashed in a real-world scenario
        role,
        companyId: companyId ? Number(companyId) : null,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update an existing user (PUT)
export async function PUT(req: Request) {
  const auth = await verifyAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id, name, email, role, companyId } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { name, email, role, companyId: companyId ? Number(companyId) : null },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Delete a user (DELETE)
export async function DELETE(req: Request) {
  const auth = await verifyAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: Number(id) } });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
