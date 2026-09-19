import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: moves }] = await Promise.all([
    supabase.from("inventory_items").select("*, vendors:preferred_vendor_id(name)").order("name"),
    supabase.from("stock_movements")
      .select("*, inventory_items(name, unit), projects(code)")
      .order("moved_on", { ascending: false }).limit(40),
  ]);

  const list = items ?? [];
  const stockValue = list.reduce((s, i) => s + num(i.quantity_on_hand) * num(i.unit_cost), 0);
  const lowStock = list.filter((i) => i.is_active && num(i.quantity_on_hand) <= num(i.reorder_level));
  const outOfStock = list.filter((i) => i.is_active && num(i.quantity_on_hand) <= 0);

  return (
    <div>
      <PageHeader title="Inventory & stores" subtitle="What's in the yard, what it's worth, what needs reordering" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stock lines" value={String(list.length)} hint={`${list.filter((i) => i.is_active).length} active`} />
        <Stat label="Stock value" value={money(stockValue)} />
        <Stat label="At or below reorder" value={String(lowStock.length)} tone={lowStock.length ? "warn" : "good"} />
        <Stat label="Out of stock" value={String(outOfStock.length)} tone={outOfStock.length ? "bad" : "good"} />
      </div>

      {lowStock.length > 0 && (
        <Card className="mb-4 border-amber-200">
          <CardHeader title="Reorder now" subtitle="At or below the reorder level" />
          <Table>
            <thead><tr>
              <Th>SKU</Th><Th>Item</Th><Th>Preferred vendor</Th>
              <Th right>On hand</Th><Th right>Reorder at</Th><Th right>Unit cost</Th>
            </tr></thead>
            <tbody>
              {lowStock.map((i) => {
                const v = i.vendors as unknown as { name: string } | null;
                return (
                  <tr key={i.id}>
                    <Td className="font-mono text-xs">{i.sku}</Td>
                    <Td className="font-medium">{i.name}</Td>
                    <Td className="text-xs text-[var(--muted)]">{v?.name ?? "—"}</Td>
                    <Td right className={num(i.quantity_on_hand) <= 0 ? "font-medium text-red-700" : "text-amber-700"}>
                      {num(i.quantity_on_hand).toFixed(0)} {i.unit}
                    </Td>
                    <Td right className="text-xs">{num(i.reorder_level).toFixed(0)}</Td>
                    <Td right>{money(i.unit_cost)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Stock register" />
          {list.length === 0 ? <Empty message="No stock items." /> : (
            <Table>
              <thead><tr>
                <Th>SKU</Th><Th>Item</Th><Th>Category</Th><Th>Location</Th>
                <Th right>On hand</Th><Th right>Unit cost</Th><Th right>Value</Th>
              </tr></thead>
              <tbody>
                {list.map((i) => {
                  const low = num(i.quantity_on_hand) <= num(i.reorder_level);
                  return (
                    <tr key={i.id} className="hover:bg-[var(--bg)]">
                      <Td className="font-mono text-xs">{i.sku}</Td>
                      <Td className="font-medium">{i.name}</Td>
                      <Td className="text-xs text-[var(--muted)]">{i.category ?? "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{i.store_location ?? "—"}</Td>
                      <Td right className={low ? "font-medium text-amber-700" : ""}>
                        {num(i.quantity_on_hand).toFixed(0)} {i.unit}
                      </Td>
                      <Td right>{money(i.unit_cost)}</Td>
                      <Td right>{money(num(i.quantity_on_hand) * num(i.unit_cost))}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent movements" />
          {!moves?.length ? <Empty message="No stock movements." /> : (
            <ul className="divide-y divide-[var(--border)]">
              {moves.map((m) => {
                const item = m.inventory_items as unknown as { name: string; unit: string } | null;
                const proj = m.projects as unknown as { code: string } | null;
                const inward = ["receipt", "return"].includes(m.move_type);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item?.name ?? "—"}</p>
                      <p className="text-xs capitalize text-[var(--muted)]">
                        {m.move_type} · {date(m.moved_on)}{proj ? ` · ${proj.code}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-medium tabular-nums ${inward ? "text-emerald-700" : "text-red-700"}`}>
                      {inward ? "+" : "−"}{num(m.quantity).toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
