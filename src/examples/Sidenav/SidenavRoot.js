/**
 * SidenavRoot — White sidebar theme
 */
import Drawer from "@mui/material/Drawer";
import { styled } from "@mui/material/styles";

export default styled(Drawer)(({ theme, ownerState }) => {
  const { transitions, breakpoints, functions } = theme;
  const { miniSidenav } = ownerState;

  const sidebarWidth = 260;
  const { pxToRem } = functions;

  const backgroundValue = "linear-gradient(180deg, #5A0002 0%, #780000 44%, #9B0008 100%)";

  const drawerOpenStyles = () => ({
    background: backgroundValue,
    borderRight: "1px solid rgba(255,255,255,0.12)",
    transform: "translateX(0)",
    transition: transitions.create("transform", {
      easing: transitions.easing.sharp,
      duration: transitions.duration.shorter,
    }),

    [breakpoints.up("xl")]: {
      boxShadow: "18px 0 42px rgba(90,0,2,0.22)",
      left: "0",
      width: sidebarWidth,
      transform: "translateX(0)",
      transition: transitions.create(["width", "background-color"], {
        easing: transitions.easing.sharp,
        duration: transitions.duration.enteringScreen,
      }),
    },
  });

  const drawerCloseStyles = () => ({
    background: backgroundValue,
    borderRight: "1px solid rgba(255,255,255,0.12)",
    transform: `translateX(${pxToRem(-320)})`,
    transition: transitions.create("transform", {
      easing: transitions.easing.sharp,
      duration: transitions.duration.shorter,
    }),

    [breakpoints.up("xl")]: {
      boxShadow: "18px 0 42px rgba(90,0,2,0.22)",
      left: "0",
      width: pxToRem(96),
      overflowX: "hidden",
      transform: "translateX(0)",
      transition: transitions.create(["width", "background-color"], {
        easing: transitions.easing.sharp,
        duration: transitions.duration.shorter,
      }),
    },
  });

  return {
    "& .MuiDrawer-paper": {
      border: "none",
      borderRadius: 0,
      color: "#fff",
      backgroundImage:
        "radial-gradient(circle at top left, rgba(229,56,59,0.35), transparent 16rem), radial-gradient(circle at bottom right, rgba(255,255,255,0.08), transparent 14rem)",
      ...(miniSidenav ? drawerCloseStyles() : drawerOpenStyles()),
    },
  };
});
