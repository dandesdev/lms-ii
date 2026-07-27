import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="My classes"
      statuses={[
        "Finding your profile",
        "Gathering published classes",
        "Laying out the list",
      ]}
    />
  );
}
