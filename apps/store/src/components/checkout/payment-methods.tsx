"use client";

import { Banknote, Smartphone } from "lucide-react";
import { Field, Input, RadioCard } from "@/components/checkout/fields";
import type { PaymentSetting } from "@/lib/settings";
import { taka } from "@/lib/format";
import { displayPhone } from "@/lib/phone";

export type PaymentMethodKey = "cod" | "manual_bkash" | "manual_nagad";

/*
 * How the customer pays.
 *
 * Cash on delivery is the default and always offered. bKash and Nagad appear
 * only when the owner has put a number in settings — a payment option with
 * nowhere to send the money is a dead end, so an unconfigured method is not
 * shown at all rather than shown and broken.
 *
 * The manual flow is honest about what it is: the customer sends the money
 * themselves and types the transaction id. Nothing here verifies it, and the
 * copy says the order is confirmed after the owner checks — because the
 * alternative is a customer who believes they have paid and an owner who has
 * not been paid.
 */
export function PaymentMethods({
  settings,
  method,
  onMethod,
  trxId,
  senderPhone,
  onTrxId,
  onSenderPhone,
  amountDue,
  errors,
}: {
  settings: PaymentSetting;
  method: PaymentMethodKey;
  onMethod: (value: PaymentMethodKey) => void;
  trxId: string;
  senderPhone: string;
  onTrxId: (value: string) => void;
  onSenderPhone: (value: string) => void;
  /** The order total, so the advance can be stated in taka. */
  amountDue: number;
  errors: Record<string, string>;
}) {
  const wallets = [
    { key: "manual_bkash" as const, label: "bKash", number: settings.bkashNumber },
    { key: "manual_nagad" as const, label: "Nagad", number: settings.nagadNumber },
  ].filter((wallet) => wallet.number !== "");

  const deposit =
    settings.codDepositEnabled && settings.codDepositAmount > 0
      ? Math.min(settings.codDepositAmount, amountDue)
      : amountDue;

  const chosen = wallets.find((wallet) => wallet.key === method);

  return (
    <div className="space-y-2">
      <RadioCard
        name="payment"
        value="cod"
        checked={method === "cod"}
        onSelect={() => onMethod("cod")}
        label="Cash on delivery"
        description="Pay the courier in cash when the parcel reaches you. Nothing now."
        icon={<Banknote size={18} className="text-rose shrink-0" />}
      />

      {wallets.map((wallet) => (
        <RadioCard
          key={wallet.key}
          name="payment"
          value={wallet.key}
          checked={method === wallet.key}
          onSelect={() => onMethod(wallet.key)}
          label={`Pay by ${wallet.label}`}
          description={
            deposit < amountDue
              ? `Send ${taka(deposit)} now, the rest in cash on delivery.`
              : `Send ${taka(amountDue)} now.`
          }
          icon={<Smartphone size={18} className="text-rose shrink-0" />}
        />
      ))}

      {chosen && (
        <div className="border-line bg-white mt-3 border p-4">
          <ol className="text-stone space-y-2 text-copy-sm">
            <li>
              1. Open your {chosen.label} app and <strong className="text-ink">Send Money</strong> to{" "}
              <strong className="text-ink tnum whitespace-nowrap">
                {displayPhone(chosen.number)}
              </strong>
            </li>
            <li>
              2. Send exactly{" "}
              <strong className="text-ink tnum">{taka(deposit)}</strong>
            </li>
            <li>3. Type the transaction ID from the confirmation below</li>
          </ol>

          <div className="mt-4 space-y-3">
            <Field
              label="Transaction ID"
              htmlFor="trxId"
              error={errors.trxId}
              hint="The TrxID in your confirmation message, e.g. 9F7A2B1C4D"
            >
              <Input
                id="trxId"
                value={trxId}
                onChange={(event) => onTrxId(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                placeholder="9F7A2B1C4D"
              />
            </Field>
            <Field
              label={`The ${chosen.label} number you sent from`}
              htmlFor="senderPhone"
              error={errors.senderPhone}
              hint="So we can find the payment if the ID is mistyped."
            >
              <Input
                id="senderPhone"
                value={senderPhone}
                onChange={(event) => onSenderPhone(event.target.value)}
                type="tel"
                inputMode="numeric"
                maxLength={24}
                placeholder="01XXXXXXXXX"
              />
            </Field>
          </div>

          <p className="text-stone-soft mt-4 text-copy-xs">
            We check the payment in our {chosen.label} app before confirming
            your order — usually within an hour. If it has not arrived we will
            call you and you can pay the courier in cash instead. Nothing is
            charged automatically.
          </p>
        </div>
      )}
    </div>
  );
}
