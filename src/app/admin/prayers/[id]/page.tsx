import { Suspense } from "react";
import { PrayerDetail } from "@/components/prayers/prayer-detail";
import { PrayerLoading } from "@/components/prayers/prayer-states";

export default async function AdminPrayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PrayerLoading />}><PrayerDetail id={id} admin /></Suspense>;
}
