import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { AturMenu } from "@/components/mobile/atur-menu";
import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { wajibMasuk } from "@/lib/auth/session";

export const metadata = { title: "Atur Menu Beranda" };

export default async function HalamanAturMenu() {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const [baris] = await db
    .select({ menuBeranda: employees.menuBeranda })
    .from(employees)
    .where(eq(employees.id, pengguna.employeeId))
    .limit(1);

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <Link
          href="/menu"
          className="text-muted hover:text-body inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium transition-colors lg:hidden"
        >
          <ArrowLeft size={15} /> Semua Menu
        </Link>
        <h1 className="text-body mt-3 text-[18px] font-bold lg:mt-2">
          Atur Menu Beranda
        </h1>
      </header>

      <AturMenu terpilihAwal={baris?.menuBeranda ?? []} />
    </div>
  );
}
