"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Interview tracking lives on the resume history page now. */
export default function InterviewsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/history");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
    </main>
  );
}
