/**
=========================================================
* Material Dashboard 2 React - CRM Footer Sticky Sans Bleu
=========================================================
*/

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import typography from "assets/theme/base/typography";

function Footer({ light }) {
  const { size } = typography;

  return (
    <MDBox
      width="100%"
      py={4}
      mt="auto" // pousse le footer en bas si le contenu est petit
      sx={{ backgroundColor: light ? "#f8f9fa" : "#ffffff" }} // couleur neutre claire ou blanche
    >
      <Container>
        <MDBox
          width="100%"
          display="flex"
          flexDirection={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          alignItems="center"
          px={1.5}
        >
          {/* Texte principal */}
          <MDBox
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexWrap="wrap"
            color={light ? "text" : "text"}
            fontSize={size.sm}
          >
            &copy; {new Date().getFullYear()}, propulsé par
            <MDBox fontSize={size.md} color="text" mb={-0.5} mx={0.25}>
              <Icon color="inherit" fontSize="inherit">
                dashboard
              </Icon>
            </MDBox>
            par
            <Link href="https://www.moncrm.com" target="_blank">
              <MDTypography variant="button" fontWeight="medium" color="text">
                &nbsp;MonCRM&nbsp;
              </MDTypography>
            </Link>
            pour une meilleure gestion de vos clients.
          </MDBox>

          {/* Liens utiles */}
          <MDBox
            component="ul"
            sx={({ breakpoints }) => ({
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              listStyle: "none",
              mt: 3,
              mb: 0,
              p: 0,
              [breakpoints.up("lg")]: { mt: 0 },
            })}
          >
            <MDBox component="li" pr={2} lineHeight={1}>
              <Link href="/about">
                <MDTypography variant="button" fontWeight="regular" color="text">
                  À propos
                </MDTypography>
              </Link>
            </MDBox>
            <MDBox component="li" px={2} lineHeight={1}>
              <Link href="/contact">
                <MDTypography variant="button" fontWeight="regular" color="text">
                  Contact
                </MDTypography>
              </Link>
            </MDBox>
            <MDBox component="li" px={2} lineHeight={1}>
              <Link href="/faq">
                <MDTypography variant="button" fontWeight="regular" color="text">
                  FAQ
                </MDTypography>
              </Link>
            </MDBox>
            <MDBox component="li" pl={2} lineHeight={1}>
              <Link href="/privacy">
                <MDTypography variant="button" fontWeight="regular" color="text">
                  Politique de confidentialité
                </MDTypography>
              </Link>
            </MDBox>
          </MDBox>
        </MDBox>
      </Container>
    </MDBox>
  );
}

Footer.defaultProps = { light: false };
Footer.propTypes = { light: PropTypes.bool };

export default Footer;
