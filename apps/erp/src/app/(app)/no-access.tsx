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
export function NoAccess({
  email,
  bootstrap = false,
}: {
  email: string;
  /** True when erp_admins is empty — nobody has been made an admin yet. */
  bootstrap?: boolean;
}) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-20">
      <div className="max-w-sm text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Heristiq
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          This account cannot use the ERP
        </h1>
        {bootstrap ? (
          /*
           * The first-run case: the table is empty, so nobody can get in —
           * including the owner. Deliberate. The ERP used to let ANY signed-in
           * account through in this state, which meant a stranger who
           * registered owned the books until the owner happened to notice.
           *
           * The recovery is one query in the Supabase SQL editor, which the
           * project owner always has. Shown here so nobody has to go looking
           * for it.
           */
          <>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              No administrator has been set yet, so the ERP is closed to
              everyone — including you. Run this once in your Supabase
              dashboard, under <span className="font-medium">SQL Editor</span>,
              then reload this page.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-left text-xs leading-relaxed text-neutral-100 dark:bg-neutral-800">
{`insert into erp_admins (email, note)
values ('${email}', 'Owner');`}
            </pre>
            <p className="mt-3 text-xs leading-relaxed text-neutral-400">
              After that you can add and remove administrators from Settings.
              If this page still refuses you, the migrations have not been
              applied to this project yet.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            You are signed in as <span className="font-medium">{email}</span>,
            but that address is not an administrator. If this is your business,
            sign in with the account you set up as admin.
          </p>
        )}
        <form action={signOut} className="mt-8">
          <button className="min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
