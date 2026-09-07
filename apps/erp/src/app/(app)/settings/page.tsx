import { createClient } from "@/lib/supabase/server";
import { adminState } from "@/lib/admin";
import { Card, Field, Input } from "@/components/ui";
import { saveDelivery, savePromo, savePayment } from "./actions";
import { addAdmin, removeAdmin } from "../admin-actions";

/*
 * Storefront settings, and who may use the ERP.
 *
 * Everything here used to be an environment variable or a hard-coded number,
 * which meant a deploy to change a delivery fee. The storefront reads these
 * rows directly and falls back to the old env values, so an un-migrated
 * database behaves exactly as it did before.
 */
export const dynamic = "force-dynamic";

type SettingRow = { key: string; value: Record<string, unknown> };

function n(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const admin = await adminState();

  const { data, error } = await supabase
    .from("storefront_settings")
    .select("key, value");
  const rows = new Map(
    ((data ?? []) as SettingRow[]).map((row) => [row.key, row.value ?? {}]),
  );
  const delivery = rows.get("delivery") ?? {};
  const promo = rows.get("promo") ?? {};
  const payment = rows.get("payment") ?? {};

  const { data: adminRows } = await supabase
    .from("erp_admins")
    .select("email, added_at")
    .order("added_at");
  const admins = (adminRows ?? []) as { email: string; added_at: string }[];

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Changes here take effect on the storefront within a minute. No deploy.
      </p>

      {error && (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Settings are unavailable: {error.message}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            The storefront is using its environment defaults until migration
            1004 is applied.
          </p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Delivery</h2>
          <form action={saveDelivery} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inside Dhaka (৳)">
                <Input
                  name="inside_dhaka_fee"
                  type="number"
                  min="0"
                  defaultValue={n(delivery.inside_dhaka_fee, 70)}
                />
              </Field>
              <Field label="Outside Dhaka (৳)">
                <Input
                  name="outside_dhaka_fee"
                  type="number"
                  min="0"
                  defaultValue={n(delivery.outside_dhaka_fee, 130)}
                />
              </Field>
            </div>
            <Field label="Free delivery over (৳) — 0 turns it off">
              <Input
                name="free_threshold"
                type="number"
                min="0"
                defaultValue={n(delivery.free_threshold, 1500)}
              />
            </Field>
            <div className="grid grid-cols-4 gap-2">
              <Field label="In min">
                <Input name="inside_days_min" type="number" min="0" defaultValue={n(delivery.inside_days_min, 1)} />
              </Field>
              <Field label="In max">
                <Input name="inside_days_max" type="number" min="0" defaultValue={n(delivery.inside_days_max, 2)} />
              </Field>
              <Field label="Out min">
                <Input name="outside_days_min" type="number" min="0" defaultValue={n(delivery.outside_days_min, 2)} />
              </Field>
              <Field label="Out max">
                <Input name="outside_days_max" type="number" min="0" defaultValue={n(delivery.outside_days_max, 4)} />
              </Field>
            </div>
            <Save />
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Promo banner</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Shows across the top of every storefront page. Leave the message
            empty to hide it whatever the switch says.
          </p>
          <form action={savePromo} className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={promo.enabled === true}
                className="size-4"
              />
              Show the banner
            </label>
            <Field label="Message">
              <Input
                name="message"
                maxLength={160}
                defaultValue={String(promo.message ?? "")}
                placeholder="Free delivery this week on orders over ৳1500"
              />
            </Field>
            <Field label="Link (optional)">
              <Input
                name="href"
                defaultValue={String(promo.href ?? "")}
                placeholder="/shop"
              />
            </Field>
            <Save />
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Your bKash and Nagad numbers. A method with no number is not offered
            at checkout, so leaving one blank turns it off.
          </p>
          <form action={savePayment} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="bKash number">
                <Input
                  name="bkash_number"
                  defaultValue={String(payment.bkash_number ?? "")}
                  placeholder="01XXXXXXXXX"
                />
              </Field>
              <Field label="Nagad number">
                <Input
                  name="nagad_number"
                  defaultValue={String(payment.nagad_number ?? "")}
                  placeholder="01XXXXXXXXX"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="cod_deposit_enabled"
                defaultChecked={payment.cod_deposit_enabled === true}
                className="size-4"
              />
              Ask for a small advance on cash-on-delivery orders
            </label>
            <Field label="Advance amount (৳)">
              <Input
                name="cod_deposit_amount"
                type="number"
                min="0"
                defaultValue={n(payment.cod_deposit_amount, 100)}
              />
            </Field>
            <p className="text-xs leading-relaxed text-neutral-500">
              An advance cuts fake orders, and it also loses some real ones.
              Turn it on if returns get expensive, not before.
            </p>
            <Save />
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Who can use the ERP</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Only these addresses. The database enforces it too, so a non-admin
            reads nothing even outside this app.
          </p>

          {admins.length === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Nobody has claimed admin access, so any signed-in account can get
              in. Use the banner at the top of the page to fix that.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {admins.map((row) => (
                <li
                  key={row.email}
                  className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2 text-sm last:border-0 dark:border-neutral-800"
                >
                  <span>
                    {row.email}
                    {admin?.email === row.email && (
                      <span className="ml-2 text-xs text-neutral-500">you</span>
                    )}
                  </span>
                  {admins.length > 1 && (
                    <form action={removeAdmin}>
                      <input type="hidden" name="email" value={row.email} />
                      <button className="text-xs text-neutral-500 hover:text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={addAdmin} className="mt-4 flex gap-2">
            <Input name="email" type="email" placeholder="another@email.com" />
            <button className="min-h-11 shrink-0 rounded-lg border border-neutral-200 px-3 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
              Add
            </button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">
            They must already have a Supabase account with this address.
          </p>
        </Card>
      </div>
    </>
  );
}

function Save() {
  return (
    <button className="min-h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
      Save
    </button>
  );
}
