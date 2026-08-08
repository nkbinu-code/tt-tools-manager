import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password;
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return NextResponse.json(
      { success: false, message: "Manager login is not configured." },
      { status: 503 },
    );
  }

  if (password !== appPassword) {
    return NextResponse.json(
      { success: false, message: "Incorrect password" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  const token = await createSessionToken();

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });

  return response;
}
