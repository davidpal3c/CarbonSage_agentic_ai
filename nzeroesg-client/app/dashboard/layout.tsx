export const metadata = {
  title: "CarbonSage Control Plane",
  description: "Manage workspace evidence and test CarbonSage decisions.",
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
