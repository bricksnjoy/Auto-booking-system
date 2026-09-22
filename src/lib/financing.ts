/**
 * Turns a project's financing sources and its profit into who gets repaid what.
 * Kept in one place so the financing page and a project's own view compute it
 * the same way, and so the rounding is handled once.
 */

export interface PoolContribution {
  contributor_name: string;
  ratio: number;
}

export interface FinancingSourceInput {
  id: string;
  name: string;
  source_type: "external_loan" | "capital_pool" | "investor";
  amount: number;
  pool: PoolContribution[];
}

export interface RepaidContributor {
  contributor_name: string;
  ratio: number;
  repayment: number;
}

export interface FinancingSourceComputed extends FinancingSourceInput {
  /** amount ÷ total financing */
  share: number;
  /** this source's slice of the repayment pool */
  repayment: number;
  contributors: RepaidContributor[];
}

export interface FinancingSummary {
  totalCost: number;
  totalFinancing: number;
  profit: number;
  repayPct: number;
  repaymentPool: number;
  /** financing − cost; positive means over-funded, negative means self-funded gap */
  variance: number;
  sources: FinancingSourceComputed[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFinancing(
  sources: FinancingSourceInput[],
  totalCost: number,
  profit: number,
  repayPct: number,
): FinancingSummary {
  const totalFinancing = sources.reduce((s, x) => s + x.amount, 0);
  const repaymentPool = round2(Math.max(profit, 0) * (repayPct / 100));

  // the largest source carries the rounding, so the slices sum to the pool
  const biggest = sources.reduce(
    (best, s, i) => (s.amount > (sources[best]?.amount ?? -1) ? i : best),
    0,
  );

  let allocated = 0;
  const computed: FinancingSourceComputed[] = sources.map((s, i) => {
    const share = totalFinancing > 0 ? s.amount / totalFinancing : 0;
    let repayment = round2(repaymentPool * share);
    if (i === biggest) repayment = round2(repaymentPool - allocated);
    else allocated = round2(allocated + repayment);

    // a capital pool splits its slice again, by each person's ratio
    let inner = 0;
    const contributors: RepaidContributor[] =
      s.source_type === "capital_pool"
        ? s.pool.map((c, j, arr) => {
            let r = round2(repayment * (c.ratio / 100));
            if (j === arr.length - 1) r = round2(repayment - inner);
            else inner = round2(inner + r);
            return { contributor_name: c.contributor_name, ratio: c.ratio, repayment: r };
          })
        : [];

    return { ...s, share, repayment, contributors };
  });

  return {
    totalCost,
    totalFinancing,
    profit,
    repayPct,
    repaymentPool,
    variance: round2(totalFinancing - totalCost),
    sources: computed,
  };
}
