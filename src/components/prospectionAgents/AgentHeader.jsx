import PropTypes from "prop-types";
import { Stack, Typography, Button } from "@mui/material";
import Icon from "@mui/material/Icon";
import { useNavigate } from "react-router-dom";

export default function AgentHeader({ title, subtitle }) {
  const navigate = useNavigate();
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      spacing={2}
      mb={3}
    >
      <div>
        <Typography variant="h4" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </div>
      <Button
        variant="outlined"
        color="dark"
        startIcon={<Icon>apps</Icon>}
        onClick={() => navigate("/prospection-agents")}
      >
        Agents
      </Button>
    </Stack>
  );
}

AgentHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
};
