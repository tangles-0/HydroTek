import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "../db/db"
import { users, accounts, sessions, verificationTokens } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

const nextAuthSecret = process.env.NEXTAUTH_SECRET
if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is required for stable JWT sessions")
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password ?? ""
        if (!email || !password) {
          return null
        }
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })
        if (!user?.passwordHash) {
          return null
        }
        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          return null
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    session: async ({ session, user, token }) => {
      if (token?.uid) {
        session.user.id = token.uid as string
      }
      return session
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id
      }
      return token
    },
  },
  session: {
    strategy: "jwt",
  },
}
