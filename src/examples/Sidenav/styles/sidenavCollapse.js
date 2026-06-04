/**
 * Custom Sidenav Collapse Styles — White + Red theme
 */
function collapseItem(theme, ownerState) {
  const { transitions, breakpoints, borders, functions } = theme;
  const { active } = ownerState;

  const { pxToRem } = functions;

  const ACTIVE_BG = "rgba(255,255,255,0.94)";
  const HOVER_BG = "rgba(255,255,255,0.12)";
  const TEXT = "rgba(255,255,255,0.78)";
  const RED = "#C1121F";

  return {
    background: active ? ACTIVE_BG : "transparent",
    color: active ? RED : TEXT,
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${pxToRem(11)} ${pxToRem(12)}`,
    margin: `${pxToRem(3)} ${pxToRem(12)}`,
    borderRadius: pxToRem(14),
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    border: active ? "1px solid rgba(255,255,255,0.95)" : "1px solid transparent",
    boxShadow: active ? "0 12px 24px rgba(0,0,0,0.16)" : "none",
    transition: "all 0.2s ease",

    [breakpoints.up("xl")]: {
      transition: transitions.create(["box-shadow", "background-color", "border", "transform"], {
        easing: transitions.easing.easeInOut,
        duration: transitions.duration.shorter,
      }),
    },

    "&:hover, &:focus": {
      backgroundColor: !active ? HOVER_BG : ACTIVE_BG,
      color: active ? RED : "#fff",
      transform: "translateX(2px)",
      "& .sidenav-icon": {
        color: active ? RED : "#fff",
      },
    },
  };
}

function collapseIconBox(theme, ownerState) {
  const { transitions, borders, functions } = theme;
  const { active } = ownerState;

  const { borderRadius } = borders;
  const { pxToRem } = functions;

  const RED = "#C1121F";

  return {
    minWidth: pxToRem(32),
    minHeight: pxToRem(32),
    color: active ? RED : "rgba(255,255,255,0.72)",
    background: active ? "rgba(193,18,31,0.10)" : "rgba(255,255,255,0.08)",
    borderRadius: borderRadius.md,
    display: "grid",
    placeItems: "center",
    transition: transitions.create("color", {
      easing: transitions.easing.easeInOut,
      duration: transitions.duration.standard,
    }),

    "& svg, svg g": {
      color: active ? RED : "rgba(255,255,255,0.72)",
    },
  };
}

const collapseIcon = (theme, { active }) => ({
  color: active ? "#C1121F" : "rgba(255,255,255,0.72)",
  fontSize: "1.1rem",
});

function collapseText(theme, ownerState) {
  const { typography, transitions, breakpoints, functions } = theme;
  const { miniSidenav, transparentSidenav, active } = ownerState;

  const { size, fontWeightRegular, fontWeightMedium } = typography;
  const { pxToRem } = functions;

  return {
    marginLeft: pxToRem(8),

    [breakpoints.up("xl")]: {
      opacity: miniSidenav || (miniSidenav && transparentSidenav) ? 0 : 1,
      maxWidth: miniSidenav || (miniSidenav && transparentSidenav) ? 0 : "100%",
      marginLeft: miniSidenav || (miniSidenav && transparentSidenav) ? 0 : pxToRem(8),
      transition: transitions.create(["opacity", "margin"], {
        easing: transitions.easing.easeInOut,
        duration: transitions.duration.standard,
      }),
    },

    "& span": {
      fontWeight: active ? fontWeightMedium : fontWeightRegular,
      fontSize: size.sm,
      lineHeight: 0,
      color: active ? "#C1121F" : "rgba(255,255,255,0.84)",
    },
  };
}

export { collapseItem, collapseIconBox, collapseIcon, collapseText };
