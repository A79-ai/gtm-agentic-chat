import { exchangeCode, GOOGLE_STATE_COOKIE, readCookie, sessionCookie } from "@/lib/googleAuth";

// Finish Google sign-in: validate state, exchange the code for the verified
// profile, set the session cookie, and return to the app.
export async function GET(req: Request) {
  const { origin, searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = readCookie(req, GOOGLE_STATE_COOKIE);

  const back = (params: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/?${params}`,
        "Set-Cookie": `${GOOGLE_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    });

  if (searchParams.get("error")) {
    return back("signin=error");
  }
  if (!(code && state && cookieState) || state !== cookieState) {
    return back("signin=error");
  }

  try {
    const user = await exchangeCode(origin, code);
    const headers = new Headers({ Location: `${origin}/?signin=google` });
    headers.append(
      "Set-Cookie",
      `${GOOGLE_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
    headers.append("Set-Cookie", sessionCookie(user));
    return new Response(null, { status: 302, headers });
  } catch {
    return back("signin=error");
  }
}
