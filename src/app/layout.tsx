import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SplashScreen } from "@/components/splash-screen";
import { auth } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vezora",
  description: "Create. Design. Define Your Identity.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#07041c] text-white">
        <Suspense fallback={null}>
          <SplashScreen />
        </Suspense>
        <Suspense fallback={<div className="h-[4.8125rem]" />}>
          <SessionHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

async function SessionHeader() {
  await connection();
  const session = await auth();
  return <SiteHeader signedIn={Boolean(session?.user)} />;
}
