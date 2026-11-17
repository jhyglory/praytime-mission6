import { PrayerComplete } from "@/components/prayers/prayer-timer";

export default async function PrayerCompletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrayerComplete id={id} />;
}
