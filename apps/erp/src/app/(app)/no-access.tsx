import { signOut } from "../login/actions";

/*
 * What a signed-in non-admin sees.
 *
 * Not a redirect back to /login — they ARE signed in, and bouncing them to a
 * login form they just completed is the loop that makes people think a site is
 * broken. It says what happened, and offers the only useful action.
 *
 * Deliberately says nothing about who the admins are.
 */
export function NoAccess({ email }: { email: string }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-20">
      <div className="max-w-sm text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Heristiq
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          This account cannot use the ERP
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          You are signed in as <span className="font-medium">{email}</span>, but
          that address is not an administrator. If this is your business, sign
          in with the account you set up as admin.
        </p>
        <form action={signOut} className="mt-8">
          <button className="min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
