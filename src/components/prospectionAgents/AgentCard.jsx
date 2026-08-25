import PropTypes from "prop-types";
import { Card, CardContent, Button, Stack, Typography, Box } from "@mui/material";
import Icon from "@mui/material/Icon";

export default function AgentCard({ icon, title, description, actionLabel, onClick }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={2} height="100%">
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: "#eef2ff",
              color: "#1f2937",
            }}
          >
            <Icon>{icon}</Icon>
          </Box>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          <Box flex={1} />
          <Button variant="contained" color="dark" onClick={onClick}>
            {actionLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

AgentCard.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  actionLabel: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};

AgentCard.defaultProps = {
  actionLabel: "Lancer",
};
