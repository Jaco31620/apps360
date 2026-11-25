import { Suspense } from "react";
import Messages from "@/components/admin/Messages";

export const metadata = { title: "Messages reçus — Backoffice" };

export default function MessagesPage() {
  return <Suspense><Messages /></Suspense>;
}
