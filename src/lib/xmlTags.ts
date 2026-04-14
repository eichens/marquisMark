export interface XmlTagDef {
  tag: string;
  description: string;
  category: "claude" | "structure" | "conversation" | "tool";
}

export const XML_TAGS: XmlTagDef[] = [
  // Claude-specific
  { tag: "instructions", description: "Top-level instructions block", category: "claude" },
  { tag: "thinking", description: "Chain-of-thought block", category: "claude" },
  { tag: "artifact", description: "Artifact content block", category: "claude" },
  { tag: "user_input", description: "Variable user input placeholder", category: "claude" },
  { tag: "antml:thinking", description: "Anthropic thinking block", category: "claude" },

  // Conversation roles
  { tag: "system", description: "System prompt section", category: "conversation" },
  { tag: "assistant", description: "Assistant response section", category: "conversation" },
  { tag: "user", description: "User message section", category: "conversation" },
  { tag: "role", description: "Role definition block", category: "conversation" },

  // Structure
  { tag: "example", description: "Example input/output pair", category: "structure" },
  { tag: "examples", description: "Container for multiple examples", category: "structure" },
  { tag: "ideal_output", description: "Expected output in an example", category: "structure" },
  { tag: "context", description: "Contextual information block", category: "structure" },
  { tag: "document", description: "Document content wrapper", category: "structure" },
  { tag: "source", description: "Source attribution", category: "structure" },
  { tag: "task", description: "Task description block", category: "structure" },
  { tag: "input", description: "Input section", category: "structure" },
  { tag: "output", description: "Output section", category: "structure" },
  { tag: "constraints", description: "Constraints or rules", category: "structure" },
  { tag: "format", description: "Output format specification", category: "structure" },

  // Tool use
  { tag: "tool_use", description: "Tool invocation block", category: "tool" },
  { tag: "tool_result", description: "Tool result content", category: "tool" },
  { tag: "result", description: "Result content", category: "tool" },
];

/** Set of known tag names for quick lookup */
export const KNOWN_TAG_NAMES = new Set(XML_TAGS.map((t) => t.tag));
