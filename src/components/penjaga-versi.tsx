"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

const VERSI_SAYA = process.env.NEXT_PUBLIC_VERSI_APLIKASI ?? "lokal";

/** Selang pemeriksaan selama aplikasi terus terbuka di layar. */
const SELANG_PERIKSA_MS = 5 * 60_000;

/**
 * Mengunci aplikasi sampai pembaharuan dipasang.
 *
 * Aplikasi dipakai berhari-hari tanpa ditutup — terpasang di layar utama
 * ponsel — sehingga versi lama bisa terus berjalan lama setelah versi baru
 * terbit, dengan aturan absensi yang sudah tidak berlaku. Versi di peramban
 * dibandingkan dengan versi di server saat aplikasi dibuka, saat kembali ke
 * layar, dan berkala; begitu berbeda, seluruh isi aplikasi dikunci dan yang
 * tersisa hanya tombol Update.
 */
export function PenjagaVersi({ children }: { children: React.ReactNode }) {
  const [adaPembaharuan, setAdaPembaharuan] = useState(false);
  const [memperbarui, setMemperbarui] = useState(false);

  const periksa = useCallback(async () => {
    try {
      const res = await fetch("/api/versi", { cache: "no-store" });
      if (!res.ok) return;
      const { versi } = (await res.json()) as { versi?: string };
      if (versi && versi !== VERSI_SAYA) setAdaPembaharuan(true);
    } catch {
      // Sedang luring: periksa lagi pada kesempatan berikutnya.
    }
  }, []);

  useEffect(() => {
    if (adaPembaharuan) return;

    // Pemeriksaan pertama dijadwalkan, bukan dipanggil langsung di effect.
    const awal = setTimeout(periksa, 0);
    const selang = setInterval(periksa, SELANG_PERIKSA_MS);
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") void periksa();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("focus", saatTerlihat);

    return () => {
      clearTimeout(awal);
      clearInterval(selang);
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("focus", saatTerlihat);
    };
  }, [adaPembaharuan, periksa]);

  async function perbarui() {
    setMemperbarui(true);
    try {
      if ("caches" in window) {
        const kunci = await caches.keys();
        await Promise.all(kunci.map((k) => caches.delete(k)));
      }
      const daftar = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((daftar ?? []).map((r) => r.unregister()));
    } catch {
      // Pembersihan hanya pelengkap; memuat ulang tetap mengambil versi baru.
    }
    window.location.reload();
  }

  return (
    <>
      {/* `contents` supaya pembungkus ini tidak mengubah tata letak apa pun;
          `inert` mematikan klik dan fokus ke aplikasi di belakang kunci. */}
      <div className="contents" inert={adaPembaharuan}>
        {children}
      </div>

      {adaPembaharuan && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="judul-pembaharuan"
          aria-describedby="isi-pembaharuan"
          className="bg-app fixed inset-0 z-[5000] grid place-items-center px-6"
        >
          <div className="w-full max-w-sm text-center">
            <div className="bg-brand-50 dark:bg-brand-900/40 mx-auto grid size-20 place-items-center rounded-full">
              <RefreshCcw className="text-brand-600 dark:text-brand-300" size={38} />
            </div>
            <h2
              id="judul-pembaharuan"
              className="text-body mt-6 text-xl font-extrabold tracking-tight"
            >
              Pembaharuan tersedia
            </h2>
            <p
              id="isi-pembaharuan"
              className="text-muted mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed"
            >
              Versi baru aplikasi sudah terbit. Perbarui dulu untuk melanjutkan — aplikasi
              tidak bisa dipakai sebelum diperbarui.
            </p>
            <Button
              size="lg"
              className="mt-7 w-full"
              onClick={perbarui}
              disabled={memperbarui}
            >
              {memperbarui ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Memperbarui…
                </>
              ) : (
                <>
                  <RefreshCcw size={18} /> Update
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
