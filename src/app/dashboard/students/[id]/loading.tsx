import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="Your classes"
      statuses={[
        "Opening the folder",
        "Gathering classes",
        "Sorting the list",
        "Laying out the page",
      ]}
    />
  );
}
