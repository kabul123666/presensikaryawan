import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite dan sharp adalah paket native/WASM — harus dijalankan di Node runtime,
  // bukan di-bundle oleh Turbopack.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],

  /*
   * Lampiran pengajuan dikirim lewat Server Action, dan batas bawaan badan
   * permintaan Server Action cuma 1 MB — jauh di bawah foto kamera ponsel yang
   * lazimnya 2–5 MB. Yang muncul karena itu bukan pesan galat aplikasi
   * melainkan layar "A server error occurred", sebab permintaannya ditolak
   * sebelum satu baris kode aplikasi sempat berjalan.
   *
   * Batasnya disamakan dengan MAKS_UKURAN_FOTO (6 MB) ditambah kelonggaran
   * untuk pembungkus multipart, supaya yang menolak berkas kebesaran adalah
   * pemeriksaan aplikasi — yang bisa menjelaskan sebabnya dalam bahasa manusia.
   */
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },

  // Header keamanan dasar (PRD §9). CSP diatur lebih ketat di middleware.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
