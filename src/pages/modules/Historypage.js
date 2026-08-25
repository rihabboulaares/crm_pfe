// src/pages/modules/Historypage.js

import React from "react";
import { Box, Typography } from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import ActivityCenter from "./ActivityCenter";

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3} px={3}>
        <Box mb={3}>
          <Typography variant="h4" fontWeight={900} sx={{ color: "var(--crm-text)" }}>
            Historique & Centre d&apos;activité
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Un seul tableau pour suivre les activités métier et les actions d&apos;audit du CRM.
          </Typography>
        </Box>
        <ActivityCenter />
      </MDBox>
    </DashboardLayout>
  );
}
