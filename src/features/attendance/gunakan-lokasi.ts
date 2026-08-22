"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type Posisi = { lat: number; lng: number; akurasi: number };

/**
 * Pembacaan posisi perangkat untuk keperluan absensi.
 *
 * Lokasi dipantau terus, bukan dibaca sekali. Pembacaan pertama sebuah ponsel
 * hampir selalu berasal dari jaringan — menara seluler atau titik Wi-Fi —
 * dengan ketelitian ratusan meter, dan GPS baru mengunci beberapa detik
 * kemudian. Membaca sekali membuat aplikasi terjebak pada tebakan kasar itu:
 * orang yang benar-benar berdiri di depan klinik tetap dianggap di luar area,
 * dan menekan coba lagi pun sering mengembalikan angka yang sama.
 *
 * Dengan watchPosition, setiap perbaikan dari perangkat langsung dipakai,
 * sehingga titiknya menajam sendiri sambil orangnya menunggu.
 *
 * Dipakai bersama oleh layar absen dan panel pengambilan foto supaya keduanya
 * tidak pernah menampilkan pembacaan yang berbeda pada saat yang sama.
 */
export function useLokasi() {
  const [posisi, setPosisi] = useState<Posisi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pantauan, setPantauan] = useState(0);

  /*
   * Dukungan geolokasi dibaca sebagai sumber di luar React.
   *
   * `navigator` tidak ada saat render di server. Memeriksanya langsung membuat
   * server menyimpulkan "perangkat tidak mendukung lokasi" sementara peramban
   * menyimpulkan sebaliknya, dan React membatalkan seluruh pohon karena
   * hidrasinya tidak cocok. Snapshot server sengaja dibuat `true` — dianggap
   * didukung sampai peramban membuktikan sebaliknya — sehingga render pertama
   * di kedua sisi sama dan tidak ada pesan galat yang berkedip.
   */
  const didukung = useSyncExternalStore(
    () => () => {},
    () => "geolocation" in navigator,
    () => true,
  );

  const terima = useCallback((pos: GeolocationPosition) => {
    setGalat(null);
    setPosisi({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      akurasi: pos.coords.accuracy,
    });
  }, []);

  const tolak = useCallback((err: GeolocationPositionError) => {
    setGalat(
      err.code === err.PERMISSION_DENIED
        ? "Izin lokasi ditolak. Aktifkan lewat pengaturan browser lalu coba lagi."
        : "Lokasi belum terbaca. Pastikan GPS menyala dan Anda tidak di ruang tertutup.",
    );
  }, []);

  /** Membuang pembacaan lama dan memulai pemantauan dari nol. */
  const perbarui = useCallback(() => {
    if (!didukung) return;
    setPosisi(null);
    setGalat(null);
    setPantauan((n) => n + 1);
  }, [didukung]);

  useEffect(() => {
    if (!didukung) return;

    const id = navigator.geolocation.watchPosition(terima, tolak, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [didukung, terima, tolak, pantauan]);

  const pesan = didukung ? galat : "Perangkat ini tidak mendukung layanan lokasi.";

  return { posisi, pesan, didukung, perbarui };
}

/** Jarak Haversine — sama dengan perhitungan server, hanya untuk pratinjau. */
export function jarakMeter(a: Posisi, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}
