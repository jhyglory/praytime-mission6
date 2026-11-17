import { PrayerTimer } from "@/components/prayers/prayer-timer";

export default async function PrayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrayerTimer id={id} />;
}
