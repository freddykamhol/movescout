import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const userCookieName = "movescout_user";

export function middleware(request: NextRequest) {
  const userCookie = request.cookies.get(userCookieName)?.value?.trim();
  if (userCookie) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  const requestedPath = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("next", requestedPath);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/kunden/:path*", "/umzuege/:path*", "/dokumente/:path*", "/einstellungen/:path*"],
};

