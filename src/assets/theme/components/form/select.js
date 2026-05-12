/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

// Material Dashboard 2 React base styles
import colors from "assets/theme/base/colors";

// Material Dashboard 2 React helper functions
import pxToRem from "assets/theme/functions/pxToRem";

const { transparent } = colors;

const select = {
  styleOverrides: {
    select: {
      display: "grid",
      alignItems: "center",
      padding: `0 ${pxToRem(12)} !important`,
      minHeight: pxToRem(40), // AJOUTER cette ligne pour fixer une hauteur minimale

      "& .Mui-selected": {
        backgroundColor: transparent.main,
      },
    },

    selectMenu: {
      background: "none",
      height: "auto", // MODIFIER de "none" à "auto"
      minHeight: pxToRem(40), // AJOUTER cette ligne
      overflow: "auto", // MODIFIER de "unset" à "auto" pour permettre le défilement
    },

    icon: {
      display: "none",
    },
  },
};

export default select;
