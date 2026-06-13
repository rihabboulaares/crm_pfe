/**
 * Sidenav — Clean & Minimalist CRM Sidebar
 * Design épuré, rouge comme couleur principale, informations claires et non encombrées
 */
import { useEffect, useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";

import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";

const API_BASE = "/api";

// Couleur principale - uniquement le rouge
const PRIMARY_COLOR = "#C1121F";
const PRIMARY_LIGHT = "rgba(255,255,255,0.12)";
const TEXT_SECONDARY = "rgba(255,255,255,0.68)";
const TEXT_PRIMARY = "#ffffff";
const BORDER_COLOR = "rgba(255,255,255,0.14)";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode } = controller;
  const location = useLocation();
  const collapseName = location.pathname.replace("/", "");

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const closeSidenav = () => setMiniSidenav(dispatch, true);

  useEffect(() => {
    const fetchSubscription = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_BASE}/subscriptions/current/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSubscription(response.data);
      } catch (error) {
        console.error("Erreur chargement abonnement:", error);
        setSubscription({
          plan: "Starter",
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          expired: false,
          days_until_expiry: 30,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  useEffect(() => {
    function handleMiniSidenav() {
      setMiniSidenav(dispatch, window.innerWidth < 1200);
      setTransparentSidenav(dispatch, window.innerWidth < 1200 ? false : transparentSidenav);
      setWhiteSidenav(dispatch, window.innerWidth < 1200 ? false : whiteSidenav);
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();
    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch, location]);

  const formatExpiryDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getPlanName = () => {
    if (!subscription) return "Starter";
    const planMap = {
      starter: "Starter",
      pro: "Pro",
      enterprise: "Enterprise",
      premium: "Premium",
    };
    return planMap[subscription.plan?.toLowerCase()] || subscription.plan || "Starter";
  };

  const getStatusColor = () => {
    if (subscription?.expired) return "#f44336";
    return PRIMARY_COLOR;
  };

  const getStatusLabel = () => {
    if (subscription?.expired) return "Expiré";
    if (subscription?.is_trial) return "Essai";
    return "Actif";
  };

  const renderRoutes = routes.map(({ type, name, icon, title, noCollapse, key, href, route }) => {
    let returnValue;

    if (type === "collapse") {
      returnValue = href ? (
        <Link
          href={href}
          key={key}
          target="_blank"
          rel="noreferrer"
          sx={{ textDecoration: "none" }}
        >
          <SidenavCollapse
            name={name}
            icon={icon}
            active={key === collapseName}
            noCollapse={noCollapse}
          />
        </Link>
      ) : (
        <NavLink key={key} to={route}>
          <SidenavCollapse name={name} icon={icon} active={key === collapseName} />
        </NavLink>
      );
    } else if (type === "title") {
      returnValue = (
        <MDTypography
          key={key}
          display="block"
          variant="caption"
          fontWeight="bold"
          textTransform="uppercase"
          pl={3}
          mt={2}
          mb={1}
          ml={1}
          sx={{
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.08em",
            fontSize: "0.65rem",
          }}
        >
          {title}
        </MDTypography>
      );
    } else if (type === "divider") {
      returnValue = <Divider key={key} sx={{ borderColor: BORDER_COLOR, mx: 2, my: 1 }} />;
    }

    return returnValue;
  });

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      {/* ── Logo / Brand ─────────────────────────────────────────────── */}
      <MDBox
        pt={3}
        pb={2}
        px={3}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderBottom: `1px solid ${BORDER_COLOR}`,
          mb: 1,
        }}
      >
        <MDBox
          display={{ xs: "block", xl: "none" }}
          position="absolute"
          top={0}
          right={0}
          p={1.625}
          onClick={closeSidenav}
          sx={{ cursor: "pointer" }}
        >
          <MDTypography variant="h6" color="secondary">
            <Icon sx={{ fontWeight: "bold" }}>close</Icon>
          </MDTypography>
        </MDBox>

        <MDBox
          component={NavLink}
          to="/"
          sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #E5383B, #C1121F)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>V</Typography>
          </Box>

          <MDBox sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
                color: TEXT_PRIMARY,
                whiteSpace: "nowrap",
              }}
            >
              ViewiseCRM
            </Typography>
          </MDBox>
        </MDBox>
      </MDBox>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <List sx={{ px: 1, py: 1, flex: 1 }}>{renderRoutes}</List>

      {/* ── Footer - Abonnement simplifié ────────────────────────────── */}
      <MDBox
        mt="auto"
        p={2}
        sx={{
          borderTop: `1px solid ${BORDER_COLOR}`,
        }}
      >
        <NavLink to="/subscriptions" style={{ textDecoration: "none" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: "10px 12px",
              borderRadius: "10px",
              bgcolor: PRIMARY_LIGHT,
              border: "1px solid rgba(255,255,255,0.12)",
              transition: "all 0.2s",
              cursor: "pointer",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.18)",
                transform: "translateY(-1px)",
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Icon sx={{ fontSize: "1rem", color: "#fff" }}>subscriptions</Icon>
              {!miniSidenav && (
                <Box>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, color: TEXT_SECONDARY }}>
                    Plan {loading ? "..." : getPlanName()}
                  </Typography>
                  {!loading && subscription?.end_date && (
                    <Typography sx={{ fontSize: "0.65rem", color: TEXT_SECONDARY }}>
                      {formatExpiryDate(subscription.end_date)}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            {!miniSidenav && (
              <Typography sx={{ fontSize: "0.7rem", color: "#fff", fontWeight: 700 }}>
                {subscription?.expired ? "Renouveler" : "Gérer"}
              </Typography>
            )}
          </Box>
        </NavLink>
      </MDBox>
    </SidenavRoot>
  );
}

Sidenav.defaultProps = {
  color: "error",
  brand: "",
};

Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
