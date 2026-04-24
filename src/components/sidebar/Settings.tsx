import { useState } from "react";
import { Settings as SettingsIcon, ChevronDown, ChevronUp } from "lucide-react";

export function Settings() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sidebar-settings">
      <button
        className="sidebar-section-header"
        onClick={() => setExpanded((e) => !e)}
      >
        <SettingsIcon size={14} />
        <span>Settings</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="sidebar-settings-content">
          <span className="sidebar-placeholder">No settings yet</span>
        </div>
      )}
    </div>
  );
}
