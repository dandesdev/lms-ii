import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LinkNotRecognized() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e6] p-6">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[#1e4d3a]" />
            English LMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-[#1e4d3a]">
              This link doesn&apos;t recognize you
            </h1>
            <p className="text-sm leading-relaxed text-[#6b6558]">
              It looks like this link is not recognizing you. You may be signed
              in with a different account, or this class belongs to another
              student. Try signing in with the email your teacher registered for
              you, or ask them for the correct link.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/student">My classes</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
