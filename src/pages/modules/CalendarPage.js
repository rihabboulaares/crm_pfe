// src/pages/modules/CalendarPage.jsx
import React from "react";
import { Box, Typography, Paper, Stack, alpha } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

// Composant calendrier ââ‚¬” importe depuis le dossier (résolu via index.js)
import CRMCalendar from "../../components/CRMCalendar";

// Layout CRM commun
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

export default function CalendarPage() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box px={{ xs: 2, md: 3 }} py={2}>
        {/* En-tete de page */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            px: { xs: 2, md: 2.5 },
            py: 2,
            borderRadius: 3,
            border: "1px solid #FFCDD2",
            bgcolor: "#FFFFFF",
            boxShadow: "0 14px 36px rgba(139,0,0,0.08)",
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha("#C62828", 0.1),
                color: "#C62828",
              }}
            >
              <CalendarMonthIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                fontWeight={900}
                sx={{ color: "#8B0000", lineHeight: 1.15, letterSpacing: 0 }}
              >
                Calendrier CRM
              </Typography>
              <Typography variant="body2" sx={{ color: "#786264", mt: 0.3 }}>
                Prochaines taches, rendez-vous, rappels et alertes commerciales.
              </Typography>
            </Box>
          </Stack>
        </Paper>
        {/* Composant calendrier principal */}
        <CRMCalendar />
      </Box>
      <Footer />
    </DashboardLayout>
  );
}
