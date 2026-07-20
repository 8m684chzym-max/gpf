import { withAuth } from "next-auth/middleware";

// Next 16 renamed the "middleware" file convention to "proxy". The import path
// below is the next-auth package (unrelated to the file name) and stays as-is.
export const proxy = withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/submit/:path*", "/road/:path*", "/open/:path*", "/games/:path*", "/weekend/:path*", "/final/:path*", "/profile/:path*", "/admin/:path*"],
};
