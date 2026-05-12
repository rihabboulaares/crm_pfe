// components/PipelineView.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  on_track: { label: "On Track", color: "#10B981", bg: "#D1FAE5", icon: "●", dot: "bg-green-500" },
  at_risk: { label: "At Risk", color: "#F59E0B", bg: "#FEF3C7", icon: "▲", dot: "bg-yellow-500" },
  delayed: { label: "Delayed", color: "#EF4444", bg: "#FEE2E2", icon: "■", dot: "bg-red-500" },
  blocked: { label: "Blocked", color: "#7C3AED", bg: "#EDE9FE", icon: "✕", dot: "bg-purple-600" },
  won: { label: "Gagné", color: "#059669", bg: "#D1FAE5", icon: "✓", dot: "bg-emerald-600" },
  lost: { label: "Perdu", color: "#9CA3AF", bg: "#F3F4F6", icon: "✗", dot: "bg-gray-400" },
};

const fmtAmount = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

const fmtDays = (d) => {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${Math.round(d)}j`;
};

const timeBarColor = (pct, status) => {
  if (status === "delayed" || status === "blocked") return "#EF4444";
  if (status === "at_risk") return "#F59E0B";
  return "#10B981";
};

const API = axios.create({ baseURL: "/api/sales/" });
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("access_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.on_track;
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
    >
      <span className="text-[10px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};

const TimeBar = ({ metrics, status }) => {
  if (!metrics || !metrics.max_days) return null;
  const pct = Math.min(100, metrics.pct_elapsed || 0);
  const color = timeBarColor(pct, status);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{fmtDays(metrics.elapsed_days)} écoulés</span>
        <span>{fmtDays(metrics.remaining_days)} restants</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const TaskBadge = ({ tasks }) => {
  if (!tasks || tasks.total === 0) return null;
  const overdue = tasks.overdue > 0;
  return (
    <div
      className={`flex items-center gap-1 text-[11px] ${
        overdue ? "text-red-500" : "text-gray-400"
      }`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
      {tasks.done}/{tasks.total}
      {overdue && <span className="text-red-500 font-bold ml-0.5">(!)</span>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// KANBAN CARD
// ─────────────────────────────────────────────────────────

const KanbanCard = ({ op, stages, onMoveStage, onClick, isDragging, onDragStart, onDragEnd }) => {
  const statusCfg = STATUS_CONFIG[op.status] || STATUS_CONFIG.on_track;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, op)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(op)}
      className={`
        bg-white rounded-xl p-3 shadow-sm border border-gray-100
        cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-gray-200
        transition-all duration-200 select-none
        ${isDragging ? "opacity-40 scale-95" : "opacity-100"}
      `}
      style={{ borderLeft: `3px solid ${statusCfg.color}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
          {op.opportunity_name}
        </p>
        <StatusBadge status={op.status} />
      </div>

      {/* Amount */}
      <div className="text-base font-bold text-gray-900 mb-2">
        {fmtAmount(op.opportunity_amount)}
      </div>

      {/* Time bar */}
      <TimeBar metrics={op.time_metrics} status={op.status} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50">
        <TaskBadge tasks={op.tasks_summary} />
        <div className="flex items-center gap-1">
          {op.alerts_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-semibold">
              ⚠ {op.alerts_count}
            </span>
          )}
          {op.opportunity_assigned_to && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
              {op.opportunity_assigned_to.username}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// KANBAN COLUMN
// ─────────────────────────────────────────────────────────

const KanbanColumn = ({ stage, onMoveStage, onCardClick, dragState, onDragStart, onDragEnd }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (dragState.card) {
      onMoveStage(dragState.card.opportunity, stage.stage_id, "");
    }
  };

  const totalValue = fmtAmount(stage.total_value);

  return (
    <div
      className={`
        flex flex-col min-w-[280px] max-w-[280px] rounded-2xl transition-all duration-200
        ${isDragOver ? "bg-blue-50 ring-2 ring-blue-300" : "bg-gray-50"}
        ${stage.is_terminal && stage.is_won ? "bg-emerald-50" : ""}
        ${stage.is_terminal && !stage.is_won ? "bg-gray-100" : ""}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.stage_color }}
            />
            <span className="text-sm font-bold text-gray-700">{stage.stage_name}</span>
          </div>
          <span className="text-xs bg-white text-gray-500 px-2 py-0.5 rounded-full font-medium shadow-sm border border-gray-100">
            {stage.count}
          </span>
        </div>
        <div className="text-xs text-gray-400 pl-5">
          {totalValue}
          {stage.max_duration_days > 0 && !stage.is_terminal && (
            <span className="ml-2 text-gray-300">· max {stage.max_duration_days}j</span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-3 pb-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-260px)]">
        {stage.opportunities.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
            Déposer ici
          </div>
        ) : (
          stage.opportunities.map((op) => (
            <KanbanCard
              key={op.id}
              op={op}
              stages={[]}
              onMoveStage={onMoveStage}
              onClick={onCardClick}
              isDragging={dragState.card?.opportunity === op.opportunity}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// LINEAR (GITLAB-STYLE) VIEW
// ─────────────────────────────────────────────────────────

const LinearView = ({ kanbanData, onMoveStage, onCardClick }) => {
  if (!kanbanData) return null;
  const stages = kanbanData.stages.filter((s) => !s.is_terminal);
  const allOps = kanbanData.stages.flatMap((s) => s.opportunities);

  return (
    <div className="space-y-3">
      {allOps.map((op) => {
        const stage = kanbanData.stages.find((s) => s.opportunities.some((o) => o.id === op.id));
        const nonTerminalStages = kanbanData.stages.filter((s) => !s.is_terminal);
        const terminalStages = kanbanData.stages.filter((s) => s.is_terminal);

        return (
          <div
            key={op.id}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onCardClick(op)}
          >
            <div className="flex flex-col gap-3">
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={op.status} />
                  <span className="font-semibold text-gray-800">{op.opportunity_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <TaskBadge tasks={op.tasks_summary} />
                  <span className="font-bold text-gray-700">
                    {fmtAmount(op.opportunity_amount)}
                  </span>
                </div>
              </div>

              {/* Stage pipeline bar */}
              <div className="flex items-center gap-1">
                {nonTerminalStages.map((s, idx) => {
                  const currentStageOrder = stage?.stage_order;
                  const isPast = s.stage_order < currentStageOrder;
                  const isCurrent = s.stage_id === stage?.stage_id;
                  const isFuture = s.stage_order > currentStageOrder;

                  return (
                    <React.Fragment key={s.stage_id}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrent) onMoveStage(op.opportunity, s.stage_id, "");
                        }}
                        className={`
                          flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all
                          ${isCurrent ? "text-white shadow-sm" : ""}
                          ${isPast ? "text-gray-400 bg-gray-50" : ""}
                          ${isFuture ? "text-gray-300 bg-gray-50 hover:bg-gray-100" : ""}
                        `}
                        style={isCurrent ? { backgroundColor: s.stage_color } : {}}
                        title={`Déplacer vers ${s.stage_name}`}
                      >
                        {s.stage_name}
                      </button>
                      {idx < nonTerminalStages.length - 1 && (
                        <svg
                          className="w-3 h-3 text-gray-200 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M8 5l8 7-8 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Terminal stages */}
                <div className="flex items-center gap-1 ml-2">
                  {terminalStages.map((s) => (
                    <button
                      key={s.stage_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveStage(op.opportunity, s.stage_id, "");
                      }}
                      className="px-2 py-1 rounded-md text-xs font-medium border transition-all hover:opacity-80"
                      style={{
                        borderColor: s.stage_color,
                        color: s.stage_color,
                        backgroundColor: `${s.stage_color}10`,
                      }}
                    >
                      {s.stage_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time bar */}
              <TimeBar metrics={op.time_metrics} status={op.status} />
            </div>
          </div>
        );
      })}

      {allOps.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Aucune opportunité dans ce pipeline</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// OPPORTUNITY DETAIL MODAL
// ─────────────────────────────────────────────────────────

const DetailModal = ({ opId, stages, onClose, onMoveStage }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moveStageId, setMoveStageId] = useState("");
  const [moveNotes, setMoveNotes] = useState("");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    API.get(`opportunity-pipelines/${opId}/`)
      .then((r) => setDetail(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [opId]);

  const handleMove = async () => {
    if (!moveStageId) return;
    setMoving(true);
    try {
      await onMoveStage(detail.opportunity, parseInt(moveStageId), moveNotes);
      const r = await API.get(`opportunity-pipelines/${opId}/`);
      setDetail(r.data);
      setMoveStageId("");
      setMoveNotes("");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Détail Pipeline</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Opportunity info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">{detail.opportunity_name}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {fmtAmount(detail.opportunity_amount)}
                  </p>
                </div>
                <StatusBadge status={detail.status} />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 pt-1">
                {detail.opportunity_assigned_to && (
                  <span>👤 {detail.opportunity_assigned_to.username}</span>
                )}
                {detail.opportunity_expected_close && (
                  <span>
                    📅 {new Date(detail.opportunity_expected_close).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            </div>

            {/* Current stage */}
            {detail.current_stage_detail && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Étape actuelle
                </p>
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: `${detail.current_stage_detail.color_hex}15` }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: detail.current_stage_detail.color_hex }}
                  />
                  <div>
                    <p className="font-semibold text-gray-800">
                      {detail.current_stage_detail.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Depuis {fmtDays(detail.time_metrics?.elapsed_days)} · Max{" "}
                      {detail.current_stage_detail.max_duration_days}j
                    </p>
                  </div>
                </div>
                <TimeBar metrics={detail.time_metrics} status={detail.status} />
              </div>
            )}

            {/* Progression */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span className="font-semibold text-gray-500 uppercase tracking-wider">
                  Progression
                </span>
                <span className="font-bold text-gray-700">{detail.progression}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${detail.progression}%` }}
                />
              </div>
            </div>

            {/* Move stage */}
            {!detail.current_stage_detail?.is_terminal && (
              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Déplacer vers une étape
                </p>
                <select
                  value={moveStageId}
                  onChange={(e) => setMoveStageId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Choisir une étape...</option>
                  {stages
                    .filter((s) => s.stage_id !== detail.current_stage)
                    .map((s) => (
                      <option key={s.stage_id} value={s.stage_id}>
                        {s.is_won === true ? "✓ " : s.is_terminal ? "✗ " : "→ "}
                        {s.stage_name}
                      </option>
                    ))}
                </select>
                <textarea
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Notes (optionnel)..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
                <button
                  onClick={handleMove}
                  disabled={!moveStageId || moving}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {moving ? "Déplacement..." : "Confirmer le déplacement"}
                </button>
              </div>
            )}

            {/* Tasks summary */}
            {detail.tasks_summary && detail.tasks_summary.total > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Tâches
                </p>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">
                      {detail.tasks_summary.done} / {detail.tasks_summary.total} terminées
                    </span>
                    {detail.tasks_summary.overdue > 0 && (
                      <span className="text-red-500 font-semibold">
                        {detail.tasks_summary.overdue} en retard
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${detail.tasks_summary.completion_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {detail.alerts && detail.alerts.filter((a) => !a.is_resolved).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Alertes actives
                </p>
                <div className="space-y-2">
                  {detail.alerts
                    .filter((a) => !a.is_resolved)
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-xl text-sm ${
                          alert.severity === "critical"
                            ? "bg-red-50 border border-red-100 text-red-700"
                            : "bg-amber-50 border border-amber-100 text-amber-700"
                        }`}
                      >
                        <span className="font-semibold">
                          {alert.severity === "critical" ? "🔴 " : "⚠️ "}
                        </span>
                        {alert.message}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {detail.history && detail.history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Timeline
                </p>
                <div className="space-y-3">
                  {detail.history.map((h, idx) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: h.to_stage_color || "#9CA3AF" }}
                        >
                          {idx + 1}
                        </div>
                        {idx < detail.history.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-100 mt-1" />
                        )}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-semibold text-gray-700">{h.action_display}</p>
                        {h.to_stage_name && (
                          <p className="text-xs text-gray-400">
                            {h.from_stage_name && `${h.from_stage_name} → `}
                            <span className="font-medium text-gray-600">{h.to_stage_name}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">
                            {new Date(h.created_at).toLocaleString("fr-FR")}
                          </p>
                          {h.duration_in_stage_hours && (
                            <span className="text-xs text-gray-300">
                              · {Math.round(h.duration_in_stage_hours)}h passées
                            </span>
                          )}
                          {h.performed_by_username && (
                            <span className="text-xs text-gray-300">
                              · {h.performed_by_username}
                            </span>
                          )}
                        </div>
                        {h.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{h.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Erreur de chargement
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// ANALYTICS PANEL
// ─────────────────────────────────────────────────────────

const AnalyticsPanel = ({ pipelineId }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!pipelineId) return;
    API.get(`pipelines/${pipelineId}/analytics/`).then((r) => setData(r.data));
  }, [pipelineId]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 mb-1">Total opportunités</p>
        <p className="text-2xl font-bold text-gray-800">{data.total_opportunities}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 mb-1">Valeur totale</p>
        <p className="text-2xl font-bold text-blue-600">{fmtAmount(data.total_value)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 mb-1">Bloquées / En retard</p>
        <p
          className={`text-2xl font-bold ${
            data.blocked_opportunities > 0 ? "text-red-500" : "text-gray-800"
          }`}
        >
          {data.blocked_opportunities}
        </p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 mb-2">Par statut</p>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(data.by_status)
            .filter(([, v]) => v.count > 0)
            .map(([key, val]) => (
              <span
                key={key}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: STATUS_CONFIG[key]?.bg || "#F3F4F6",
                  color: STATUS_CONFIG[key]?.color || "#6B7280",
                }}
              >
                {val.count} {val.label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// ALERTS PANEL
// ─────────────────────────────────────────────────────────

const AlertsPanel = ({ pipelineId, onDismiss }) => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    API.get("pipeline-alerts/", { params: { is_resolved: false } })
      .then((r) => setAlerts(r.data.results || r.data))
      .catch(console.error);
  }, [pipelineId]);

  const resolve = async (id) => {
    await API.patch(`pipeline-alerts/${id}/resolve/`);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl text-sm ${
            alert.severity === "critical"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
          }`}
        >
          <div className="flex items-start gap-2">
            <span>{alert.severity === "critical" ? "🔴" : "⚠️"}</span>
            <div>
              <span className="font-semibold">{alert.opportunity_name} — </span>
              {alert.message}
            </div>
          </div>
          <button
            onClick={() => resolve(alert.id)}
            className="flex-shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
      {alerts.length > 3 && (
        <p className="text-xs text-center text-gray-400">+{alerts.length - 3} autres alertes</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// MAIN PIPELINE VIEW COMPONENT
// ─────────────────────────────────────────────────────────

const PipelineView = () => {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [kanbanData, setKanbanData] = useState(null);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "linear"
  const [loading, setLoading] = useState(false);
  const [selectedOpId, setSelectedOpId] = useState(null);
  const [dragState, setDragState] = useState({ card: null });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load pipelines
  useEffect(() => {
    API.get("pipelines/", { params: { is_active: true } })
      .then((r) => {
        const list = r.data.results || r.data;
        setPipelines(list);
        if (list.length > 0) setSelectedPipelineId(list[0].id);
      })
      .catch(console.error);
  }, []);

  // Load kanban data when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) return;
    setLoading(true);
    API.get(`pipelines/${selectedPipelineId}/kanban/`)
      .then((r) => setKanbanData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPipelineId, refreshKey]);

  const handleMoveStage = useCallback(
    async (opportunityId, stageId, notes) => {
      const op_pipeline = kanbanData?.stages
        .flatMap((s) => s.opportunities)
        .find((o) => o.opportunity === opportunityId);
      if (!op_pipeline) return;
      try {
        await API.post(`opportunity-pipelines/${op_pipeline.id}/move-stage/`, {
          stage_id: stageId,
          notes,
        });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        console.error("Move stage error:", err);
      }
    },
    [kanbanData]
  );

  const handleDragStart = (e, op) => {
    setDragState({ card: op });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => setDragState({ card: null });

  const allStages = kanbanData?.stages || [];
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-800">Pipeline</h1>

          {/* Pipeline selector */}
          <div className="flex items-center gap-1.5">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPipelineId(p.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${
                    selectedPipelineId === p.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-100"
                  }
                `}
              >
                {p.pipeline_type === "b2b" ? "🏢" : p.pipeline_type === "b2c" ? "👤" : "📋"}{" "}
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Analytics toggle */}
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
              showAnalytics ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            📊 Analytics
          </button>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="Rafraîchir"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* View mode switch */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-gray-700 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              ⊞ Kanban
            </button>
            <button
              onClick={() => setViewMode("linear")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === "linear"
                  ? "bg-white text-gray-700 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              ≡ Linéaire
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-5">
        {/* Alerts panel */}
        <AlertsPanel pipelineId={selectedPipelineId} />

        {/* Analytics */}
        {showAnalytics && <AnalyticsPanel pipelineId={selectedPipelineId} />}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="animate-spin w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full" />
              <p className="text-sm">Chargement du pipeline...</p>
            </div>
          </div>
        ) : !kanbanData ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-sm">Aucun pipeline disponible</p>
          </div>
        ) : viewMode === "kanban" ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanData.stages.map((stage) => (
              <KanbanColumn
                key={stage.stage_id}
                stage={stage}
                onMoveStage={handleMoveStage}
                onCardClick={(op) => setSelectedOpId(op.id)}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        ) : (
          <LinearView
            kanbanData={kanbanData}
            onMoveStage={handleMoveStage}
            onCardClick={(op) => setSelectedOpId(op.id)}
          />
        )}
      </div>

      {/* Detail modal */}
      {selectedOpId && (
        <DetailModal
          opId={selectedOpId}
          stages={allStages}
          onClose={() => {
            setSelectedOpId(null);
            setRefreshKey((k) => k + 1);
          }}
          onMoveStage={handleMoveStage}
        />
      )}
    </div>
  );
};

export default PipelineView;
