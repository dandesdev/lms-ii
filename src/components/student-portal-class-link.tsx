"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { prefetchClassEditorChunk } from "@/lib/prefetch-class-editor";

export function StudentPortalClassLink({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const boot = useClassBoot();
  const router = useRouter();
  const href = `/class/${id}`;

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => {
        router.prefetch(href);
        prefetchClassEditorChunk();
      }}
      onClick={() => {
        prefetchClassEditorChunk();
        boot.start({ title, mode: "open" });
      }}
      className="flex items-center justify-between py-3 transition-colors hover:bg-[#faf7f0] -mx-2 px-2 rounded-md"
    >
      <p className="font-medium">{title}</p>
      <Badge variant="success">published</Badge>
    </Link>
  );
}
