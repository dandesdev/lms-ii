import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      title="Opening class"
      statuses={[
        "Finding the class",
        "Opening the workspace",
        "Loading the editor",
      ]}
    />
  );
}
