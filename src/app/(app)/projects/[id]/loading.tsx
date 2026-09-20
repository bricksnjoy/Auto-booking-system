import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton stats={4} rows={8} />;
}
