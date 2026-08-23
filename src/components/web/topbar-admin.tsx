"use client";

import { LogOut, Moon, Sun } from "lucide-react";

import { aksiKeluar } from "@/features/auth/actions";
import { useJamLengkap } from "@/lib/gunakan-jam";
import { terapkanTema, useGelapAktif } from "@/lib/tema";
import { inisial } from "@/lib/utils";

const LABEL_PERAN: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / HRD",
  MANAGER: "Kepala Unit",
};

export function TopbarAdmin({
  nama,
  peran,
  jabatan,
}: {
  nama: string;
  peran: string;
  jabatan: string | null;
}) {
  const jam = useJamLengkap();
  const gelap = useGelapAktif();

  return (
    <header className="bg-surface/85 border-app z-20 shrink-0 border-b backdrop-blur-xl lg:sticky lg:top-0">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 lg:px-8">
        <p className="text-muted hidden text-[13px] font-medium sm:block">
          {jam ? `${jam} WIB` : " "}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => terapkanTema(gelap ? "terang" : "gelap")}
            className="text-muted hover:bg-surface-muted hover:text-body grid size-10 place-items-center rounded-xl transition-colors"
            aria-label={gelap ? "Gunakan mode terang" : "Gunakan mode gelap"}
          >
            {gelap ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="border-app flex items-center gap-2.5 border-l pl-3">
            <span className="bg-brand-600 grid size-9 place-items-center rounded-full text-[12.5px] font-extrabold text-white">
              {inisial(nama)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="text-body block truncate text-[13px] font-bold">
                {nama}
              </span>
              <span className="text-subtle block truncate text-[11px]">
                {LABEL_PERAN[peran] ?? peran}
                {jabatan ? ` · ${jabatan}` : ""}
              </span>
            </span>
          </div>

          <form action={aksiKeluar}>
            <button
              type="submit"
              className="text-muted hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15 grid size-10 place-items-center rounded-xl transition-colors"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
