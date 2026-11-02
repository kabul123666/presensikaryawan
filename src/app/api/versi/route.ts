import { NextResponse } from "next/server";

/**
 * Versi aplikasi yang sedang berjalan di server.
 *
 * Selalu dibaca segar, tidak pernah dari cache: gunanya justru memberi tahu
 * peramban yang masih memegang versi lama bahwa sudah ada pembaharuan.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { versi: process.env.NEXT_PUBLIC_VERSI_APLIKASI ?? "lokal" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
