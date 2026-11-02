import {
  BarChart3,
  Calculator,
  Database,
  FileInput,
  FileSearch,
  FileText,
  Users,
  Wrench,
} from "lucide-react";

export const featuresData = [
  {
    id: 1,
    title: "Traceable calculations",
    icon: Wrench,
    description:
      "Versioned factors, explicit assumptions, normalized inputs, and warnings keep every displayed result inspectable.",
  },
  {
    id: 2,
    title: "Cited supplier evidence",
    icon: Calculator,
    description:
      "Bounded document ingestion and PostgreSQL retrieval preserve supplier, file, page, and chunk locations.",
  },
  {
    id: 3,
    title: "Isolated workspaces",
    icon: Database,
    description:
      "Signed sessions, server-side quotas, retention, and workspace-scoped repositories protect every user-owned record.",
  },
];

export const comingSoonData = [
  {
    id: 1,
    title: "Artifact control plane",
    icon: Calculator,
    description:
      "Manage shipment datasets, evidence documents, and generated decision artifacts with provenance.",
  },
  {
    id: 2,
    title: "Evaluated hybrid RAG",
    icon: FileInput,
    description:
      "Compare full-text, pgvector semantic, and hybrid retrieval to tune ranking against representative questions.",
  },
  {
    id: 3,
    title: "Typed agent tools",
    icon: FileSearch,
    description:
      "Orchestrate evidence search, emissions calculations, scenarios, data quality, and reports through validated commands.",
  },
  {
    id: 4,
    title: "Structured conversations",
    icon: Users,
    description:
      "Return cited text, metrics, tables, charts, warnings, artifact links, and safe suggested actions.",
  },
  {
    id: 5,
    title: "JavaScript embed",
    icon: BarChart3,
    status: "Coming soon",
    description:
      "Mount the authenticated agent in an existing application through an isolated iframe and small loader.",
  },
  {
    id: 6,
    title: "Selected-file import",
    icon: FileText,
    status: "Planned",
    description:
      "Import one explicitly selected Google Drive file through the same bounded artifact pipeline.",
  },
];
