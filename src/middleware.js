import { withAuth } from "next-auth/middleware";

export const middleware = withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/submit/:path*", "/road/:path*", "/weekend/:path*", "/final/:path*", "/profile/:path*", "/admin/:path*"],
};
