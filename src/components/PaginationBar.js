/* eslint-disable prettier/prettier */
// src/components/PaginationBar/index.jsx
// Composant de pagination réutilisable pour toutes les listes

import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  Chip,
} from "@mui/material";
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  KeyboardDoubleArrowLeft,
  KeyboardDoubleArrowRight,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

const C = { red: "#dc2626", n200: "#e2e8f0", n400: "#94a3b8", n800: "#1e293b" };

export default function PaginationBar({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  color = C.red,
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Génère les numéros de page à afficher (avec ellipsis)
  const getPageNumbers = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const nums = new Set([1, pages, page]);
    for (let i = page - 1; i <= page + 1; i++) {
      if (i >= 1 && i <= pages) nums.add(i);
    }
    const sorted = [...nums].sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) result.push("...");
      result.push(n);
      prev = n;
    }
    return result;
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={1.5}
      px={2}
      py={1.5}
      sx={{ borderTop: `1px solid ${C.n200}` }}
    >
      {/* Info */}
      <Typography sx={{ fontSize: 12, color: C.n400 }}>
        {total === 0 ? "Aucun résultat" : `${from}–${to} sur `}
        {total > 0 && <strong style={{ color: C.n800 }}>{total}</strong>}
        {total > 0 && " résultats"}
      </Typography>

      {/* Pages */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        {/* Première page */}
        <Tooltip title="Première page">
          <span>
            <IconButton
              size="small"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(1)}
              sx={{ borderRadius: 2, "&:not(:disabled):hover": { bgcolor: alpha(color, 0.08) } }}
            >
              <KeyboardDoubleArrowLeft sx={{ fontSize: 16, color: page <= 1 ? C.n400 : color }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Page précédente */}
        <Tooltip title="Page précédente">
          <span>
            <IconButton
              size="small"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              sx={{ borderRadius: 2, "&:not(:disabled):hover": { bgcolor: alpha(color, 0.08) } }}
            >
              <KeyboardArrowLeft sx={{ fontSize: 16, color: page <= 1 ? C.n400 : color }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Numéros */}
        {getPageNumbers().map((n, i) =>
          n === "..." ? (
            <Typography key={`e${i}`} sx={{ fontSize: 12, color: C.n400, px: 0.5 }}>
              …
            </Typography>
          ) : (
            <Box
              key={n}
              onClick={() => !loading && onPageChange(n)}
              sx={{
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                cursor: loading ? "default" : "pointer",
                bgcolor: n === page ? color : "transparent",
                color: n === page ? "#fff" : C.n400,
                fontWeight: n === page ? 700 : 500,
                fontSize: 13,
                transition: "all 0.15s",
                "&:hover": n !== page && !loading ? { bgcolor: alpha(color, 0.08), color } : {},
              }}
            >
              {n}
            </Box>
          )
        )}

        {/* Page suivante */}
        <Tooltip title="Page suivante">
          <span>
            <IconButton
              size="small"
              disabled={page >= pages || loading}
              onClick={() => onPageChange(page + 1)}
              sx={{ borderRadius: 2, "&:not(:disabled):hover": { bgcolor: alpha(color, 0.08) } }}
            >
              <KeyboardArrowRight sx={{ fontSize: 16, color: page >= pages ? C.n400 : color }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Dernière page */}
        <Tooltip title="Dernière page">
          <span>
            <IconButton
              size="small"
              disabled={page >= pages || loading}
              onClick={() => onPageChange(pages)}
              sx={{ borderRadius: 2, "&:not(:disabled):hover": { bgcolor: alpha(color, 0.08) } }}
            >
              <KeyboardDoubleArrowRight
                sx={{ fontSize: 16, color: page >= pages ? C.n400 : color }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Taille de page */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={{ fontSize: 12, color: C.n400 }}>Lignes :</Typography>
        <FormControl size="small">
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            sx={{
              height: 30,
              fontSize: 12,
              borderRadius: 2,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: C.n200 },
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <MenuItem key={n} value={n} sx={{ fontSize: 12 }}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}

PaginationBar.propTypes = {
  page: PropTypes.number.isRequired,
  pages: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  color: PropTypes.string,
};
