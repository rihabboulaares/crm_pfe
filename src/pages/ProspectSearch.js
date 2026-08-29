import React from "react";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import ProspectionWorkspace from "../components/prospection/ProspectionWorkspace";

export default function ProspectSearch() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <ProspectionWorkspace />
    </DashboardLayout>
  );
}
