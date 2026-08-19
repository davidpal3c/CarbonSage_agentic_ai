export const metadata = {
  title: "CarbonSage Workspace",
  description: "Manage freight data, evidence, scenarios, and decisions.",
};

import { ReactNode } from "react";

import WorkspaceShell from "@/app/dashboard/WorkspaceShell";

export default function UserPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
