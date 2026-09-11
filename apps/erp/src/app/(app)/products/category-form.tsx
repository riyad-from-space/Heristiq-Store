"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { createCategory, updateCategory } from "./actions";

/*
 * Categories are the storefront's browse structure, so this edits more than
 * a name: each one is a page at /shop/<slug> with a heading, a line of copy
 * beneath it, and a place in the menu.
 *
 * What is NOT editable is the web address. The database derives it from the
 * name when the category is CREATED and then leaves it alone — renaming
 * "Pendants" to "Pendants & Charms" keeps /shop/pendants, so a rename never
 * 404s links already shared on WhatsApp or Instagram.
 *
 * The consequence is that an address can drift from its name, so it is shown
 * beside every category rather than hidden: this is the only place the owner
 * can see what their page's URL actually is.
 */
export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, action, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await createCategory(prev, fd);
      if (!result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="New category" required />
        {/* Narrow, because it is a sort key and not a quantity — a wide box
            invites someone to type a year into it. */}
        <Input
          name="position"
          type="number"
          min={0}
          placeholder="#"
          className="w-16"
          title="Menu order, low first"
        />
        <Button type="submit" tone="ghost" disabled={pending}>
          Add
        </Button>
      </div>
      <Input name="blurb" placeholder="One line for the shop page (optional)" />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

/*
 * Editing an existing one, opened per row rather than always visible.
 *
 * Five categories each showing four fields would be twenty inputs in a
 * sidebar card, which buries the thing the page is actually for — adding
 * products. Collapsed, the list stays a list.
 */
export function CategoryEditor({
  category,
}: {
  category: {
    id: string;
    name: string;
    slug: string | null;
    blurb: string | null;
    position: number | null;
    is_active: boolean | null;
  };
}) {
  const [open, setOpen] = useState(false);

  const [error, action, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await updateCategory(prev, fd);
      if (!result) setOpen(false);
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded border border-neutral-200 px-2.5 py-1.5 text-left text-sm hover:bg-neutral-50"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{category.name}</span>
          {/* The address the shop will use. Shown because it is derived, so
              this is the only place the owner finds out what it became. */}
          <span className="truncate font-mono text-[11px] text-neutral-400">
            /shop/{category.slug}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500">
          {category.is_active === false && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5">hidden</span>
          )}
          <span>#{category.position ?? 100}</span>
          <span className="text-neutral-400">edit</span>
        </span>
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded border border-neutral-300 p-2.5">
      <input type="hidden" name="id" value={category.id} />

      <div className="flex gap-2">
        <Input name="name" defaultValue={category.name} required />
        <Input
          name="position"
          type="number"
          min={0}
          defaultValue={category.position ?? 100}
          className="w-16"
          title="Menu order, low first"
        />
      </div>

      {/* Spelled out because it is the one non-obvious rule here, and the
          alternative is the owner renaming a category and later wondering
          why the address no longer matches. */}
      <p className="text-[11px] text-neutral-500">
        Web address stays <span className="font-mono">/shop/{category.slug}</span>{" "}
        even if you change the name, so links already shared keep working.
      </p>

      <Field label="Line shown under the heading on the shop page">
        <Textarea name="blurb" rows={2} defaultValue={category.blurb ?? ""} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={category.is_active !== false}
        />
        Show in the shop
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
