/**
 * Mengecilkan foto lampiran di peramban sebelum diunggah.
 *
 * Foto kamera ponsel lazimnya 2–5 MB, dan mengirimnya utuh lewat Server Action
 * berarti menunggu belasan detik di jaringan seluler klinik untuk gambar yang
 * pada akhirnya diperkecil juga di server. Dikecilkan lebih dulu di sini,
 * unggahannya tinggal ratusan kilobyte.
 *
 * Sekalian menyelesaikan foto HEIC dari iPhone: peramban yang bisa
 * menampilkannya juga bisa menggambarnya ke kanvas, dan yang keluar dari kanvas
 * selalu JPEG — jenis yang memang diterima server.
 *
 * Kegagalan tidak pernah dianggap fatal: berkas aslinya dikembalikan apa adanya
 * dan biar pemeriksaan server yang memutuskan, lengkap dengan pesannya.
 */

const SISI_MAKS = 1600;
const MUTU = 0.8;

/** Di bawah ukuran ini, mengecilkan hanya menambah langkah tanpa manfaat. */
const AMBANG_AMAN = 700 * 1024;

const JENIS_AMAN = ["image/jpeg", "image/png", "image/webp"];

async function muatGambar(berkas: File): Promise<
  CanvasImageSource & {
    width: number;
    height: number;
  }
> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(berkas, { imageOrientation: "from-image" });
  }

  const url = URL.createObjectURL(berkas);
  try {
    const gambar = new Image();
    await new Promise<void>((selesai, gagal) => {
      gambar.onload = () => selesai();
      gambar.onerror = () => gagal(new Error("Gambar tidak terbaca"));
      gambar.src = url;
    });
    return Object.assign(gambar, {
      width: gambar.naturalWidth,
      height: gambar.naturalHeight,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function kecilkanFoto(berkas: File): Promise<File> {
  if (!berkas.type.startsWith("image/")) return berkas;
  if (JENIS_AMAN.includes(berkas.type) && berkas.size <= AMBANG_AMAN) return berkas;

  const gambar = await muatGambar(berkas);
  const sisiTerpanjang = Math.max(gambar.width, gambar.height);
  if (!sisiTerpanjang) return berkas;

  const skala = Math.min(1, SISI_MAKS / sisiTerpanjang);
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(gambar.width * skala);
  kanvas.height = Math.round(gambar.height * skala);

  const ctx = kanvas.getContext("2d");
  if (!ctx) return berkas;
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);

  const blob = await new Promise<Blob | null>((selesai) => {
    kanvas.toBlob(selesai, "image/jpeg", MUTU);
  });
  if (!blob) return berkas;

  // Hasilnya justru lebih besar untuk gambar yang sudah padat — pakai aslinya.
  if (blob.size >= berkas.size) return berkas;

  return new File([blob], "lampiran.jpg", { type: "image/jpeg" });
}
