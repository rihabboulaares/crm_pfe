/**
 * Custom Sidenav Collapse Styles — White + Red theme
 */
function collapseItem(theme, ownerState) {
  const { transitions, breakpoints, borders, functions } = theme;
  const { active } = ownerState;

  const { borderRadius } = borders;
  const { pxToRem } = functions;

  const RED = "#d32f2f";
  const RED_LIGHT = "rgba(211, 47, 47, 0.08)";

  return {
    background: active ? RED_LIGHT : "transparent",
    color: active ? RED : "#374151",
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${pxToRem(10)} ${pxToRem(12)}`,
    margin: `${pxToRem(2)} ${pxToRem(12)}`,
    borderRadius: borderRadius.md,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderLeft: active ? `3px solid ${RED}` : "3px solid transparent",
    transition: "all 0.2s ease",

    [breakpoints.up("xl")]: {
      transition: transitions.create(["box-shadow", "background-color", "border-left"], {
        easing: transitions.easing.easeInOut,
        duration: transitions.duration.shorter,
      }),
    },

    "&:hover, &:focus": {
      backgroundColor: !active ? "rgba(211, 47, 47, 0.05)" : RED_LIGHT,
      color: RED,
      "& .sidenav-icon": {
        color: RED,
      },
    },
  };
}

function collapseIconBox(theme, ownerState) {
  const { transitions, borders, functions } = theme;
  const { active } = ownerState;

  const { borderRadius } = borders;
  const { pxToRem } = functions;

  const RED = "#d32f2f";

  return {
    minWidth: pxToRem(32),
    minHeight: pxToRem(32),
    color: active ? RED : "#9ca3af",
    borderRadius: borderRadius.md,
    display: "grid",
    placeItems: "center",
    transition: transitions.create("color", {
      easing: transitions.easing.easeInOut,
      duration: transitions.duration.standard,
    }),

    "& svg, svg g": {
      color: active ? RED : "#9ca3af",
    },
  };
}

const collapseIcon = (theme, { active }) => ({
  color: active ? "#d32f2f" : "#9ca3af",
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
      color: active ? "#d32f2f" : "#374151",
    },
  };
}

export { collapseItem, collapseIconBox, collapseIcon, collapseText };
