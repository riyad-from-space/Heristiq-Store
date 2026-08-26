import { Nav } from "@/components/nav";
import { signOut } from "../login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
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
