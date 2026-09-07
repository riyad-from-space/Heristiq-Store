"use server";

import {
  saveMessage,
  subscribe,
  type MessageInput,
  type SaveResult,
  type SubscribeResult,
} from "@/lib/messages";

/*
 * The contact form and the newsletter, as server actions.
 *
 * Thin, like the checkout's: validation and storage live in lib/messages.ts.
 * Both are public POST endpoints, so neither trusts its input, and both return
 * errors as values because every one of them is something the customer can
 * act on.
 */
export async function sendMessageAction(input: MessageInput): Promise<SaveResult> {
  try {
    return await saveMessage(input);
  } catch (error) {
    console.error("[contact] saveMessage failed", error);
    return {
      ok: false,
      error:
        "We could not send that just now. Please message us on WhatsApp instead — the link is below.",
    };
  }
}

export async function subscribeAction(email: string): Promise<SubscribeResult> {
  try {
    return await subscribe(email);
  } catch (error) {
    console.error("[newsletter] subscribe failed", error);
    return { ok: false, error: "We could not add you just now. Try again later." };
  }
}
