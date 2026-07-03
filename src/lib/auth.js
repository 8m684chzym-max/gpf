import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: { email: { label: "Email", type: "text" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        console.error("[auth] missing email or password in request");
        return null;
      }

      const email = credentials.email.toLowerCase().trim();
      let user;
      try {
        user = await prisma.user.findUnique({ where: { email } });
      } catch (err) {
        console.error("[auth] DB error while looking up user:", err);
        return null;
      }

      if (!user) {
        console.error("[auth] no user found for email:", email);
        return null;
      }

      if (!user.passwordHash) {
        console.error("[auth] user found but has no passwordHash set:", email);
        return null;
      }

      let ok;
      try {
        ok = await bcrypt.compare(credentials.password, user.passwordHash);
      } catch (err) {
        console.error("[auth] bcrypt.compare threw:", err);
        return null;
      }

      if (!ok) {
        console.error("[auth] password mismatch for:", email);
        return null;
      }

      console.log("[auth] login success for:", email);
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    },
  }),
];
export const authOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  // Force the session cookie to be Secure + SameSite=Lax in production so it
  // is never sent over plain HTTP and is not attached to cross-site requests.
  cookies: process.env.NODE_ENV === "production" ? {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
  } : undefined,
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
