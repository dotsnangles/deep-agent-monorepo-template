import { NextResponse } from "next/server";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(`${AGENT_SERVER_URL}/copilotkit/health`, {
      cache: "no-store",
    });
    const body = await response.json();

    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { status: "offline", error: "Agent server is unavailable" },
      { status: 502 },
    );
  }
}
