"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Peta area absen.
 *
 * Memakai ubin OpenStreetMap — gratis, tanpa kunci API, dan pada pemakaian
 * sebesar klinik ini jauh di bawah batas wajarnya. Ubin dimuat dari jaringan,
 * jadi keterangan jarak dan batas tetap ditampilkan terpisah di bawah peta:
 * saat sinyal lemah petanya bisa lambat, dan justru pada saat itulah orang
 * paling perlu tahu apakah ia sudah berada di dalam area.
 *
 * Petanya sengaja tidak bisa digeser atau di-zoom. Yang ditanyakan karyawan
 * hanya "apakah saya di dalam lingkaran", dan peta yang bisa digeser di
 * tengah alur absen lebih sering tergeser tanpa sengaja daripada dipakai.
 */
export function PetaLeaflet({
  posisi,
  pusat,
  radiusM,
  akurasiM,
  diLuarArea,
  kelasTinggi = "h-52",
}: {
  /** Null selagi GPS belum terbaca — areanya tetap digambar. */
  posisi: { lat: number; lng: number } | null;
  pusat: { lat: number; lng: number };
  radiusM: number;
  akurasiM: number;
  diLuarArea: boolean;
  /** Tinggi wadah peta; layar absen memakainya lebih tinggi. */
  kelasTinggi?: string;
}) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const petaRef = useRef<L.Map | null>(null);
  const lapisanRef = useRef<L.LayerGroup | null>(null);

  // Peta dibuat sekali; isinya diperbarui pada effect berikutnya supaya
  // pembacaan GPS yang datang beruntun tidak membangun ulang seluruh peta.
  useEffect(() => {
    if (!wadahRef.current || petaRef.current) return;

    const peta = L.map(wadahRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(peta);

    petaRef.current = peta;
    lapisanRef.current = L.layerGroup().addTo(peta);

    return () => {
      peta.remove();
      petaRef.current = null;
      lapisanRef.current = null;
    };
  }, []);

  useEffect(() => {
    const peta = petaRef.current;
    const lapisan = lapisanRef.current;
    if (!peta || !lapisan) return;

    lapisan.clearLayers();

    const warna = diLuarArea ? "#9e2b3c" : "#0f5340";

    // Batas area yang diizinkan
    L.circle([pusat.lat, pusat.lng], {
      radius: radiusM,
      color: warna,
      weight: 2,
      dashArray: "5 5",
      fillColor: warna,
      fillOpacity: 0.12,
    }).addTo(lapisan);

    // Titik tempat kerja
    L.circleMarker([pusat.lat, pusat.lng], {
      radius: 5,
      color: "#ffffff",
      weight: 2,
      fillColor: warna,
      fillOpacity: 1,
    }).addTo(lapisan);

    // Ketelitian pembacaan, lalu posisi karyawan di atasnya
    if (posisi) {
      L.circle([posisi.lat, posisi.lng], {
        radius: Math.max(akurasiM, 1),
        color: "#0ea5e9",
        weight: 1,
        fillColor: "#0ea5e9",
        fillOpacity: 0.12,
      }).addTo(lapisan);

      L.circleMarker([posisi.lat, posisi.lng], {
        radius: 7,
        color: "#ffffff",
        weight: 3,
        fillColor: "#0ea5e9",
        fillOpacity: 1,
      }).addTo(lapisan);
    }

    // Bingkai harus memuat seluruh lingkaran batas, bukan hanya kedua titik.
    // Tanpa ini, area seluas ratusan meter jatuh di luar layar ketika orangnya
    // kebetulan berdiri dekat pusat — dan justru batas itulah yang ingin
    // dilihat sebelum menekan tombol absen.
    const batas = L.latLng(pusat.lat, pusat.lng).toBounds(radiusM * 2);
    if (posisi) batas.extend([posisi.lat, posisi.lng]);

    peta.fitBounds(batas.pad(0.08), { maxZoom: 18, animate: false });
  }, [posisi, pusat.lat, pusat.lng, radiusM, akurasiM, diLuarArea]);

  return (
    <div
      ref={wadahRef}
      className={`w-full ${kelasTinggi}`}
      aria-label="Peta area absen"
    />
  );
}
