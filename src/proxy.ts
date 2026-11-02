import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESI = "alia_sesi";

/**
 * Halaman yang boleh diakses tanpa masuk. /api/versi ikut terbuka supaya
 * pemeriksaan pembaharuan juga berjalan di halaman masuk.
 */
const RUTE_PUBLIK = ["/masuk", "/daftar", "/lupa-password", "/api/versi"];

/**
 * Penjaga lapis pertama: hanya memeriksa keberadaan cookie sesi supaya murah
 * dan tidak menyentuh database. Verifikasi sesungguhnya (sesi valid, peran,
 * kepemilikan data) tetap dilakukan di server component dan server action —
 * lapisan ini tidak pernah menjadi satu-satunya pengaman.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const punyaSesi = Boolean(request.cookies.get(COOKIE_SESI)?.value);
  const rutePublik = RUTE_PUBLIK.some((r) => pathname.startsWith(r));

  if (!punyaSesi && !rutePublik) {
    const tujuan = request.nextUrl.clone();
    tujuan.pathname = "/masuk";
    tujuan.search = pathname === "/" ? "" : `?lanjut=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(tujuan);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Semua rute kecuali aset statis, berkas gambar, dan endpoint internal
     * Next.js — agar middleware tidak berjalan sia-sia pada setiap aset.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
