import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials.password ?? "");
        if (!email || !password) return null;
        const user = await getPrisma().user.findUnique({ where: { email } });
        if (!user) return null;
        const matches = await verifyPassword(password, user.passwordHash);
        if (!matches) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
