/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

// Material Dashboard 2 React base styles
import colors from "assets/theme/base/colors";
import boxShadows from "assets/theme/base/boxShadows";
import borders from "assets/theme/base/borders";

const { white } = colors;
const { md } = boxShadows;
const { borderRadius } = borders;

const tableContainer = {
  styleOverrides: {
    root: {
      backgroundColor: white.main,
      boxShadow: md,
      borderRadius: borderRadius.xl,
      overflowX: "auto",
      width: "100%",
    },
  },
};

export default tableContainer;
