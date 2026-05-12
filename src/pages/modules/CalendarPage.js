// src/pages/modules/CalendarPage.jsx
import React from "react";
import { Box, Typography } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

// Composant calendrier — importe depuis le dossier (résolu via index.js)
import CRMCalendar from "../../components/CRMCalendar";

// Layout CRM commun
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

export default function CalendarPage() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box px={3} py={2}>
        {/* En-tête de page */}
        <Box
          display="flex"
          alignItems="center"
          gap={1.5}
          mb={3}
          pb={2}
          sx={{ borderBottom: "2px solid #FFCDD2" }}
        >
          <CalendarMonthIcon sx={{ color: "#C62828", fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: "#8B0000", lineHeight: 1.2 }}>
              Calendrier
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tâches, activités, alertes et étapes pipeline
            </Typography>
          </Box>
        </Box>

        {/* Composant calendrier principal */}
        <CRMCalendar />
      </Box>
      <Footer />
    </DashboardLayout>
  );
}
