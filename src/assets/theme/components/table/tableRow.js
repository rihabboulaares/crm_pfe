/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

// Material Dashboard 2 React base styles
import colors from "assets/theme/base/colors";

const { light } = colors;

const tableRow = {
  styleOverrides: {
    root: {
      "&:hover": {
        backgroundColor: light.main,
      },
    },
  },
};

export default tableRow;
