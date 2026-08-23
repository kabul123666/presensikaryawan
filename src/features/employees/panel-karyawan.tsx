"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Pencil, Power, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import type { Role, UserStatus } from "@/db/schema";
import { cn, inisial } from "@/lib/utils";
import { tanggalPendek } from "@/lib/waktu";
import {
  aksiResetPassword,
  aksiTambahKaryawan,
  aksiUbahKaryawan,
  aksiUbahStatusAkun,
  aksiVerifikasiPendaftaran,
  type HasilKaryawan,
} from "./actions";
import type { BarisKaryawan } from "./service";

type Opsi = {
  departemen: { id: string; nama: string }[];
  jabatan: { id: string; nama: string; isiFormTindakan: boolean }[];
  lokasi: { id: string; nama: string }[];
  shift: { id: string; nama: string; jamMasuk: string; jamPulang: string }[];
};

const LABEL_STATUS: Record<
  UserStatus,
  { teks: string; nada: "brand" | "warn" | "danger" | "netral" }
> = {
  ACTIVE: { teks: "Aktif", nada: "brand" },
  PENDING_APPROVAL: { teks: "Menunggu verifikasi", nada: "warn" },
  INVITED: { teks: "Diundang", nada: "netral" },
  SUSPENDED: { teks: "Nonaktif", nada: "danger" },
  REJECTED: { teks: "Ditolak", nada: "danger" },
};

const LABEL_PERAN: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / HRD",
  MANAGER: "Kepala Unit",
  KARYAWAN: "Karyawan",
};

/** Kotak yang menampilkan password sementara satu kali, dengan tombol salin. */
function KotakPassword({ password, onTutup }: { password: string; onTutup: () => void }) {
  const [tersalin, setTersalin] = useState(false);

  return (
    <div className="border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/40 rounded-[var(--radius-card)] border p-4">
      <p className="text-brand-800 dark:text-brand-100 text-sm font-bold">
        Password sementara — catat sekarang
      </p>
      <p className="text-brand-700/85 dark:text-brand-200/80 mt-1 text-[13px]">
        Password ini hanya ditampilkan sekali. Sampaikan ke karyawan lalu minta segera
        diganti.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="bg-surface border-app text-body flex-1 rounded-lg border px-3 py-2 font-mono text-base font-bold tracking-wider">
          {password}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setTersalin(true);
            setTimeout(() => setTersalin(false), 2000);
          }}
        >
          {tersalin ? <Check size={15} /> : <Copy size={15} />}
          {tersalin ? "Tersalin" : "Salin"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
          <X size={15} />
        </Button>
      </div>
    </div>
  );
}

/** Formulir tambah / ubah karyawan. */
function FormKaryawan({
  opsi,
  karyawan,
  onSelesai,
}: {
  opsi: Opsi;
  karyawan: BarisKaryawan | null;
  onSelesai: (hasil: HasilKaryawan) => void;
}) {
  const ubah = Boolean(karyawan);
  const [hasil, kirim, sedang] = useActionState<HasilKaryawan | null, FormData>(
    ubah ? aksiUbahKaryawan : aksiTambahKaryawan,
    null,
  );

  useEffect(() => {
    if (hasil?.ok) onSelesai(hasil);
  }, [hasil, onSelesai]);

  const jabatanTerpilih = opsi.jabatan.find((j) => j.nama === karyawan?.jabatan);

  return (
    <form action={kirim} className="space-y-4">
      {karyawan && <input type="hidden" name="employeeId" value={karyawan.employeeId} />}

      {hasil && !hasil.ok && (
        <div className="bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium">
          {hasil.pesan}
        </div>
      )}

      <div>
        <Label htmlFor="nama">Nama lengkap</Label>
        <Input id="nama" name="nama" defaultValue={karyawan?.nama} required />
      </div>

      {!ubah && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
              required
            />
            <Hint>3–40 karakter: huruf kecil, angka, titik, dan garis bawah.</Hint>
          </div>
          <div>
            <Label htmlFor="nik">NIK / NIP</Label>
            <Input id="nik" name="nik" />
            <Hint>Boleh dikosongkan.</Hint>
          </div>
        </div>
      )}

      {opsi.lokasi.length > 1 && (
        <div>
          <Label htmlFor="lokasiTambahan">Cabang tambahan</Label>
          <div className="border-app bg-surface-muted mt-1.5 space-y-1.5 rounded-[var(--radius-input)] border p-3">
            {opsi.lokasi.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  name="lokasiTambahan"
                  value={l.id}
                  defaultChecked={karyawan?.lokasiTambahanIds?.includes(l.id) ?? false}
                  className="accent-brand-600 size-4"
                />
                <span className="text-body text-sm">{l.nama}</span>
              </label>
            ))}
          </div>
          <Hint>
            Untuk jabatan yang berkeliling — ia boleh absen di lokasi kerjanya maupun di
            cabang yang dicentang di sini. Biarkan kosong bila hanya bertugas di satu
            tempat.
          </Hint>
        </div>
      )}

      <label className="border-app bg-surface-muted flex cursor-pointer items-start gap-3 rounded-[var(--radius-input)] border p-3.5">
        <input
          type="checkbox"
          name="wajibAbsen"
          defaultChecked={karyawan?.wajibAbsen ?? true}
          className="accent-brand-600 mt-0.5 size-4"
        />
        <span>
          <span className="text-body block text-sm font-bold">Mencatatkan kehadiran</span>
          <span className="text-muted mt-0.5 block text-[13px]">
            Matikan untuk akun pengelola yang tidak ikut absen — ia tidak akan terhitung
            sebagai belum absen, dan tidak muncul di rekap maupun jadwal jaga.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="noHp">Nomor HP</Label>
          <Input id="noHp" name="noHp" defaultValue={karyawan?.noHp ?? ""} />
        </div>
        <div>
          <Label htmlFor="role">Peran</Label>
          <Select id="role" name="role" defaultValue={karyawan?.role ?? "KARYAWAN"}>
            <option value="KARYAWAN">Karyawan</option>
            <option value="MANAGER">Kepala Unit</option>
            <option value="ADMIN">Admin / HRD</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="departmentId">Departemen</Label>
          <Select
            id="departmentId"
            name="departmentId"
            defaultValue={
              opsi.departemen.find((d) => d.nama === karyawan?.departemen)?.id ?? ""
            }
          >
            <option value="">— Belum diatur —</option>
            {opsi.departemen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="positionId">Jabatan</Label>
          <Select
            id="positionId"
            name="positionId"
            defaultValue={jabatanTerpilih?.id ?? ""}
          >
            <option value="">— Belum diatur —</option>
            {opsi.jabatan.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nama}
                {j.isiFormTindakan ? " (mencatat tindakan)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="locationId">Lokasi kerja</Label>
          <Select
            id="locationId"
            name="locationId"
            defaultValue={opsi.lokasi.find((l) => l.nama === karyawan?.lokasi)?.id ?? ""}
          >
            <option value="">— Belum diatur —</option>
            {opsi.lokasi.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nama}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="shiftId">Shift default</Label>
          <Select
            id="shiftId"
            name="shiftId"
            defaultValue={opsi.shift.find((s) => s.nama === karyawan?.shift)?.id ?? ""}
          >
            <option value="">— Belum diatur —</option>
            {opsi.shift.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.jamMasuk.slice(0, 5)}–{s.jamPulang.slice(0, 5)})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipeKaryawan">Status kepegawaian</Label>
          <Select id="tipeKaryawan" name="tipeKaryawan" defaultValue="TETAP">
            <option value="TETAP">Tetap</option>
            <option value="KONTRAK">Kontrak</option>
            <option value="PARUH_WAKTU">Paruh waktu</option>
            <option value="MAGANG">Magang</option>
          </Select>
        </div>
        {!ubah && (
          <div>
            <Label htmlFor="tanggalMasuk">Tanggal masuk</Label>
            <Input id="tanggalMasuk" name="tanggalMasuk" type="date" />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="gajiPokok">Gaji pokok (opsional)</Label>
        <Input
          id="gajiPokok"
          name="gajiPokok"
          type="number"
          min={0}
          step={100000}
          placeholder="Dipakai untuk hitung pencairan cuti"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={sedang}>
        {sedang && <Loader2 size={17} className="animate-spin" />}
        {ubah ? "Simpan perubahan" : "Tambahkan karyawan"}
      </Button>
    </form>
  );
}

/* ========================================================================== */

export function PanelKaryawan({
  daftar,
  opsi,
  pendaftaran,
}: {
  daftar: BarisKaryawan[];
  opsi: Opsi;
  pendaftaran: {
    userId: string;
    nama: string;
    username: string;
    nik: string | null;
    noHp: string | null;
    createdAt: string;
  }[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"tambah" | "ubah" | null>(null);
  const [resetUntuk, setResetUntuk] = useState<BarisKaryawan | null>(null);
  const [passwordBaru, setPasswordBaru] = useState("");
  const [terpilih, setTerpilih] = useState<BarisKaryawan | null>(null);
  const [hasil, setHasil] = useState<HasilKaryawan | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [proses, mulai] = useTransition();

  function jalankan(fn: () => Promise<HasilKaryawan>) {
    mulai(async () => {
      const res = await fn();
      setHasil(res);
      if (res.passwordSementara) setPassword(res.passwordSementara);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {hasil && (
        <div
          role="status"
          className={cn(
            "rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium",
            hasil.ok
              ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
              : "bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100",
          )}
        >
          {hasil.pesan}
        </div>
      )}

      {password && (
        <KotakPassword password={password} onTutup={() => setPassword(null)} />
      )}

      {/* Antrean pendaftaran mandiri */}
      {pendaftaran.length > 0 && (
        <div className="border-warn-500/40 bg-warn-50 dark:bg-warn-500/10 rounded-[var(--radius-card)] border p-4">
          <h2 className="text-warn-700 dark:text-warn-100 text-sm font-extrabold">
            {pendaftaran.length} pendaftaran menunggu verifikasi
          </h2>
          <ul className="mt-3 space-y-2">
            {pendaftaran.map((p) => (
              <li
                key={p.userId}
                className="bg-surface border-app flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-input)] border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-body text-sm font-bold">{p.nama}</p>
                  <p className="text-subtle text-xs">
                    {p.username} · {p.nik ?? "tanpa NIK"} · daftar{" "}
                    {tanggalPendek(p.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={proses}
                    onClick={() =>
                      jalankan(() => aksiVerifikasiPendaftaran(p.userId, false))
                    }
                  >
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    disabled={proses}
                    onClick={() =>
                      jalankan(() => aksiVerifikasiPendaftaran(p.userId, true))
                    }
                  >
                    Setujui
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Daftar karyawan */}
      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <div className="border-app flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-body text-base font-extrabold">
            Daftar karyawan
            <span className="text-subtle ml-2 text-sm font-semibold">
              {daftar.length}
            </span>
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setTerpilih(null);
              setModal("tambah");
            }}
          >
            <UserPlus size={15} /> Tambah karyawan
          </Button>
        </div>

        {daftar.length === 0 ? (
          <p className="text-muted px-5 py-12 text-center text-sm">
            Tidak ada karyawan yang cocok dengan penyaring.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm lg:min-w-[860px]">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-3 py-2.5 lg:px-5">Karyawan</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Jabatan</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Shift</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Peran</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Status</th>
                  <th className="px-5 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((k) => (
                  <tr
                    key={k.employeeId}
                    className="border-app hover:bg-surface-muted border-b transition-colors last:border-0"
                  >
                    <td className="max-w-0 px-3 py-3 lg:max-w-none lg:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="bg-brand-600 hidden size-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white lg:grid">
                          {inisial(k.nama)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-body truncate font-semibold">{k.nama}</p>
                          <p className="text-subtle truncate text-xs">
                            {k.username} · {k.nik ?? "—"}
                          </p>
                          {/* Di ponsel kolom di kanan disembunyikan, jadi isinya
                              diringkas di sini agar tidak hilang. */}
                          <p className="text-subtle truncate text-xs lg:hidden">
                            {k.jabatan ?? LABEL_PERAN[k.role]}
                          </p>
                          <Badge
                            tone={LABEL_STATUS[k.status].nada}
                            className="mt-1 lg:hidden"
                          >
                            {LABEL_STATUS[k.status].teks}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted hidden px-3 py-3 lg:table-cell">
                      {k.jabatan ?? "—"}
                      <span className="text-subtle block text-xs">
                        {k.departemen ?? "—"}
                      </span>
                    </td>
                    <td className="text-muted hidden px-3 py-3 lg:table-cell">
                      {k.shift ?? "—"}
                    </td>
                    <td className="text-muted hidden px-3 py-3 lg:table-cell">
                      {LABEL_PERAN[k.role]}
                    </td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <Badge tone={LABEL_STATUS[k.status].nada}>
                        {LABEL_STATUS[k.status].teks}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 lg:px-5">
                      <div className="flex justify-end gap-0.5 lg:gap-1">
                        <button
                          title="Ubah data"
                          aria-label={`Ubah data ${k.nama}`}
                          disabled={proses}
                          onClick={() => {
                            setTerpilih(k);
                            setModal("ubah");
                          }}
                          className="text-muted hover:bg-surface-muted hover:text-body grid size-8 place-items-center rounded-lg transition-colors lg:size-9"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Reset password"
                          aria-label={`Reset password ${k.nama}`}
                          disabled={proses}
                          onClick={() => {
                            setPasswordBaru("");
                            setResetUntuk(k);
                          }}
                          className="text-muted hover:bg-surface-muted hover:text-body grid size-8 place-items-center rounded-lg transition-colors lg:size-9"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          title={k.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                          aria-label={`${k.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"} ${k.nama}`}
                          disabled={proses}
                          onClick={() =>
                            jalankan(() =>
                              aksiUbahStatusAkun(k.userId, k.status !== "ACTIVE"),
                            )
                          }
                          className={cn(
                            "grid size-9 place-items-center rounded-lg transition-colors",
                            k.status === "ACTIVE"
                              ? "text-muted hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                              : "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/40",
                          )}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog ganti password */}
      {resetUntuk && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-[var(--overlay)]"
            onClick={() => setResetUntuk(null)}
          />
          <div className="bg-surface border-app relative w-full max-w-md rounded-[var(--radius-sheet)] border p-6 shadow-[var(--shadow-float)]">
            <h2 className="text-body text-base font-extrabold">
              Ganti password {resetUntuk.nama}
            </h2>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">
              Password lama tidak bisa ditampilkan karena yang tersimpan hanya hash-nya.
              Tentukan penggantinya, atau kosongkan untuk dibuatkan acak.
            </p>

            <div className="mt-4">
              <Label htmlFor="passwordBaru">Password baru</Label>
              <Input
                id="passwordBaru"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                autoComplete="off"
                className="font-mono"
                placeholder="Kosongkan untuk password acak"
              />
              <Hint>Minimal 8 karakter bila diisi.</Hint>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                disabled={proses}
                onClick={() => {
                  const p = passwordBaru;
                  const u = resetUntuk.userId;
                  setResetUntuk(null);
                  jalankan(() => aksiResetPassword(u, p || undefined));
                }}
                className="flex-1"
              >
                {proses && <Loader2 size={16} className="animate-spin" />}
                Ganti password
              </Button>
              <Button type="button" variant="outline" onClick={() => setResetUntuk(null)}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal formulir */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-5 py-10">
          <button
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setModal(null)}
            aria-label="Tutup"
          />
          <div className="bg-surface relative w-full max-w-xl rounded-[var(--radius-sheet)] p-6 shadow-[var(--shadow-float)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-body text-lg font-extrabold tracking-tight">
                  {modal === "tambah" ? "Tambah karyawan" : `Ubah data ${terpilih?.nama}`}
                </h2>
                <p className="text-muted mt-1 text-sm">
                  {modal === "tambah"
                    ? "Akun langsung aktif dengan password sementara."
                    : "Perubahan tercatat di audit log."}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-subtle hover:text-body grid size-9 place-items-center rounded-lg"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <FormKaryawan
              opsi={opsi}
              karyawan={modal === "ubah" ? terpilih : null}
              onSelesai={(res) => {
                setModal(null);
                setHasil(res);
                if (res.passwordSementara) setPassword(res.passwordSementara);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
