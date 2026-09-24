import { BottomNav } from "@/components/BottomNav";
import { requireAthlete } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAthlete();
  return (
    <>
      <main className="mx-auto max-w-lg px-4 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
