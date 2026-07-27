import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="Sign in"
      statuses={["Opening the door", "Almost ready"]}
    />
  );
}
