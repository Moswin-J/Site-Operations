export const config = {
  matcher: ["/((?!robots.txt).*)"],
};

export default function middleware(request: Request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    return;
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(":");
    if (colon >= 0) {
      const givenUser = decoded.slice(0, colon);
      const givenPass = decoded.slice(colon + 1);
      if (givenUser === user && givenPass === pass) {
        return;
      }
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Site Operations"',
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  });
}
