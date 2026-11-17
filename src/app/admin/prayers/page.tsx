import { Suspense } from "react";
import { PrayerList } from "@/components/prayers/prayer-list";
import { PrayerLoading } from "@/components/prayers/prayer-states";

export default function AdminPrayersPage() { return <Suspense fallback={<PrayerLoading />}><PrayerList admin /></Suspense>; }
