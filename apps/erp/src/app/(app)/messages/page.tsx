import { createClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Badge, Card, Empty } from "@/components/ui";
import type { StorefrontMessage } from "@/lib/store-types";
import { markMessageHandled } from "../orders/actions";

/*
 * Messages from the storefront's contact form.
 *
 * Unhandled first, because that is the only reason to open this page. Marking
 * one handled is a timestamp, not a delete — a customer who says "I wrote to
 * you last week" should be answerable.
 */
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storefront_messages")
    .select("*")
    .order("handled_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(100);

  const messages = (data ?? []) as StorefrontMessage[];
  const open = messages.filter((m) => !m.handled_at);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-neutral-500">
          {open.length} waiting for a reply
        </p>
      </div>

      {error && (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Could not read messages: {error.message}
          </p>
        </Card>
      )}

      {messages.length === 0 ? (
        <Empty>
          Nothing yet. Messages sent from the storefront&apos;s contact page
          land here.
        </Empty>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {messages.map((message) => (
            <Card key={message.id} className={message.handled_at ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {message.name}
                    {message.order_reference && (
                      <span className="ml-2 font-mono text-xs text-neutral-500">
                        {message.order_reference}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {message.phone && (
                      <a href={`tel:+88${message.phone}`} className="hover:underline">
                        {displayPhone(message.phone)}
                      </a>
                    )}
                    {message.phone && message.email && " · "}
                    {message.email && (
                      <a href={`mailto:${message.email}`} className="hover:underline">
                        {message.email}
                      </a>
                    )}
                    {" · "}
                    {dateTime(message.created_at)}
                  </p>
                </div>
                {message.handled_at ? (
                  <Badge tone="good">Handled</Badge>
                ) : (
                  <form action={markMessageHandled}>
                    <input type="hidden" name="id" value={message.id} />
                    <button className="min-h-9 rounded-lg border border-neutral-200 px-3 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
                      Mark handled
                    </button>
                  </form>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
                {message.message}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
