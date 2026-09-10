import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { SessionKeeper } from "@/components/session-keeper";
import { adminState } from "@/lib/admin";
import { signOut } from "../login/actions";
import { NoAccess } from "./no-access";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  /*
   * Every authenticated page renders through this layout, so these two checks
   * gate the whole app: signed in, AND an administrator.
   *
   * The second is the one that was missing. Being signed in used to be enough,
   * which meant anyone who registered — sign-ups are open by default — reached
   * the ERP. The database enforces the same rule now (migration 1004); this is
   * what makes the refusal legible instead of a screen of empty tables.
   */
  const admin = await adminState();
  if (!admin) redirect("/login");
  if (!admin.isAdmin)
    return <NoAccess email={admin.email} bootstrap={admin.bootstrap} />;

  return (
    <div className="flex flex-1 flex-col">
      <SessionKeeper />
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-4">
            <span className="text-base font-semibold tracking-tight">
              Heristiq
            </span>
            <form action={signOut} className="md:hidden">
              <button className="text-sm text-neutral-500 hover:underline">
                Sign out
              </button>
            </form>
          </div>
          <Nav />
          <form action={signOut} className="hidden md:block">
            <button className="text-sm text-neutral-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
