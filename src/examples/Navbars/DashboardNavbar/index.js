/* eslint-disable prettier/prettier */
// examples/Navbars/DashboardNavbar/index.js

import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";

import MDBox from "components/MDBox";
import MDInput from "components/MDInput";

import Breadcrumbs from "examples/Breadcrumbs";

import NotificationBell from "pages/modules/NotificationBell"; // ← chemin selon ta structure

import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";

function DashboardNavbar({ absolute, light, isMini }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;
  const route = useLocation().pathname.split("/").slice(1);
  const [storedUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || localStorage.getItem("currentUser") || "{}");
    } catch {
      return {};
    }
  });
  const displayName =
    storedUser?.username || storedUser?.first_name || storedUser?.email || storedUser?.company || "CRM";
  const displayRole = storedUser?.role || storedUser?.company_name || "Workspace";
  const isAdmin = String(storedUser?.role || "").toUpperCase() === "ADMIN";
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }

    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();
    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get("http://127.0.0.1:8000/api/subscriptions/current/", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => setSubscription(response.data))
      .catch(() => setSubscription(null));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/authentication/sign-in";
  };

  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;
      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }
      return colorValue;
    },
  });

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        {/* ── Gauche : breadcrumb ── */}
        <MDBox color="inherit" mb={{ xs: 1, md: 0 }} sx={(theme) => navbarRow(theme, { isMini })}>
          <Breadcrumbs icon="home" title={route[route.length - 1]} route={route} light={light} />
        </MDBox>

        {/* ── Droite : actions ── */}
        {isMini ? null : (
          <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
            {/* Search */}
            <MDBox pr={1}>
              <MDInput label="Rechercher" />
            </MDBox>

            <MDBox color={light ? "white" : "inherit"} display="flex" alignItems="center" gap={0.5}>
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.5,
                  mr: 0.5,
                  borderRadius: 2,
                  border: "1px solid rgba(229,231,235,0.9)",
                  bgcolor: "#fff",
                }}
              >
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#C1121F",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                  }}
                >
                  {String(displayName).charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1F2937" }}>
                    {displayName}
                  </Typography>
                  <Typography sx={{ fontSize: "0.66rem", color: "#6B7280", lineHeight: 1 }}>
                    {displayRole}
                  </Typography>
                </Box>
              </Box>
              {/* Profil */}
              <Link to="/profile">
                <IconButton sx={navbarIconButton} size="small" disableRipple>
                  <Icon sx={iconsStyle}>account_circle</Icon>
                </IconButton>
              </Link>
              {/* Logout */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={handleLogout}
              >
                <Icon sx={iconsStyle}>logout</Icon>
              </IconButton>
              {/* Mobile menu */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu}
                onClick={handleMiniSidenav}
              >
                <Icon sx={iconsStyle} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>
              {/* Settings */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={handleConfiguratorOpen}
              >
                <Icon sx={iconsStyle}>settings</Icon>
              </IconButton>
              {/* ── Cloche de notifications (remplace l'ancienne icône) ── */}
              <NotificationBell /> {/* ← AJOUT */}
            </MDBox>
          </MDBox>
        )}
      </Toolbar>
      {subscription &&
        ((subscription.days_until_expiry <= 7 && !subscription.expired && !subscription.is_blocked) ||
          subscription.expired ||
          subscription.is_blocked) && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Alert
              severity={subscription.expired || subscription.is_blocked ? "error" : "warning"}
              action={
                isAdmin ? (
                  <Button component={Link} to="/subscriptions" color="inherit" size="small">
                    Renouveler
                  </Button>
                ) : null
              }
            >
              {subscription.expired || subscription.is_blocked
                ? isAdmin
                  ? "Votre abonnement est expiré."
                  : "Votre abonnement est expiré. Contactez votre administrateur."
                : `Votre abonnement expire dans ${subscription.days_until_expiry} jours.`}
            </Alert>
          </Box>
        )}
    </AppBar>
  );
}

DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
