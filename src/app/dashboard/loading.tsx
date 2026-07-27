import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="Dashboard"
      statuses={[
        "Gathering your students",
        "Checking class readiness",
        "Laying out the board",
      ]}
    />
  );
}
