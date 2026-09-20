"use client";

import { useState } from "react";
import { ShopModal, type ShopValues } from "@/components/shop-modal";

export function ShopHeaderActions({ shop }: { shop: ShopValues }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setEditing(true)}
        className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover)]">
        Edit shop
      </button>
      <ShopModal open={editing} onClose={() => setEditing(false)} values={shop} />
    </>
  );
}
