import { PrayerEditor } from "@/components/prayers/prayer-form";

export default async function EditPrayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrayerEditor id={id} />;
}
