import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="Welcome"
      statuses={["Getting things ready", "Almost there"]}
    />
  );
}
