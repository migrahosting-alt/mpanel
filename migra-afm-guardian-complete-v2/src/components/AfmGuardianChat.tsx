import React, { useState, useRef, useEffect } from "react";

type Message = {
  from: "user" | "abigail";
  text: string;
  decidedTool?: string;
  mode?: string;
  toolResult?: any;
};

type ToolOption = "dns_list_records" | "user_get_summary" | "backups_list";

type Props = {
  endpoint: string;
  getToken: () => Promise<string> | string;
};

const TOOL_OPTIONS: { value: ToolOption; label: string }[] = [
  { value: "dns_list_records", label: "DNS Records" },
  { value: "user_get_summary", label: "User Summary" },
  { value: "backups_list", label: "Backups List" },
];

export const AfmGuardianChat: React.FC<Props> = ({ endpoint, getToken }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [selectedTool, setSelectedTool] = useState<ToolOption>("dns_list_records");
  const [toolInput, setToolInput] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    if (loading) return;
    setLoading(true);

    let body: any;
    if (mode === "auto") {
      body = {
        message: input,
        history: messages.map((m) => ({ from: m.from, text: m.text })),
      };
    } else {
      // Manual tool call
      let inputObj: any = {};
      if (selectedTool === "dns_list_records") inputObj = { zone: toolInput };
      if (selectedTool === "user_get_summary") inputObj = { query: toolInput };
      if (selectedTool === "backups_list") inputObj = { domain: toolInput };
      body = {
        toolCall: {
          name: selectedTool,
          input: inputObj,
        },
      };
    }

    const token = typeof getToken === "function" ? await getToken() : getToken;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { from: "user", text: mode === "auto" ? input : `[${selectedTool}] ${toolInput}` },
        {
          from: "abigail",
          text: data.reply || "No reply.",
          decidedTool: data.decidedTool?.name || data.toolCall?.name,
          mode: data.mode,
          toolResult: data.toolResult,
        },
      ]);
      setInput("");
      setToolInput("");
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { from: "abigail", text: "Error contacting AFM Gateway." },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          className="fixed bottom-6 right-6 bg-indigo-700 hover:bg-indigo-800 text-white rounded-full w-16 h-16 shadow-lg flex items-center justify-center z-50"
          onClick={() => setOpen(true)}
          aria-label="Open Abigail Chat"
        >
          <span className="text-2xl font-bold">A</span>
        </button>
      )}

      {/* Chat Drawer/Modal */}
      {open && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[32rem] bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-t-2xl shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-800">
            <span className="font-bold text-lg">Abigail Support</span>
            <button
              className="text-indigo-300 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Message History */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-2xl ${
                    msg.from === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-200 text-indigo-900"
                  }`}
                >
                  {msg.text}
                  {msg.from === "abigail" && (
                    <>
                      {msg.decidedTool && (
                        <div className="text-xs mt-1 text-indigo-500">
                          Tool: {msg.decidedTool}
                        </div>
                      )}
                      {msg.mode && (
                        <div className="text-xs text-indigo-400">
                          Mode: {msg.mode}
                        </div>
                      )}
                      {msg.toolResult && (
                        <div className="mt-1">
                          <button
                            className="text-xs underline text-indigo-500"
                            onClick={() => setDebugOpen((o) => !o)}
                          >
                            {debugOpen ? "Hide Debug" : "Show Debug"}
                          </button>
                          {debugOpen && (
                            <pre className="bg-indigo-100 text-indigo-800 text-xs rounded p-2 mt-1 max-h-32 overflow-auto">
                              {JSON.stringify(msg.toolResult, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-xs px-3 py-2 rounded-2xl bg-indigo-200 text-indigo-900 animate-pulse">
                  Abigail is thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-indigo-800 bg-indigo-950">
            <div className="flex items-center mb-2">
              <button
                className={`px-2 py-1 rounded-l bg-indigo-800 text-xs ${
                  mode === "auto" ? "font-bold text-white" : "text-indigo-300"
                }`}
                onClick={() => setMode("auto")}
              >
                Auto (LLM)
              </button>
              <button
                className={`px-2 py-1 rounded-r bg-indigo-800 text-xs ${
                  mode === "manual" ? "font-bold text-white" : "text-indigo-300"
                }`}
                onClick={() => setMode("manual")}
              >
                Manual
              </button>
            </div>
            {mode === "auto" ? (
              <div className="flex">
                <input
                  className="flex-1 rounded-l px-3 py-2 bg-indigo-100 text-indigo-900 focus:outline-none"
                  type="text"
                  placeholder="Ask Abigail anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && input && sendMessage()}
                  disabled={loading}
                />
                <button
                  className="rounded-r bg-indigo-700 px-4 py-2 text-white font-bold"
                  onClick={sendMessage}
                  disabled={loading || !input}
                >
                  Send
                </button>
              </div>
            ) : (
              <div>
                <div className="flex mb-2">
                  <select
                    className="rounded-l px-2 py-2 bg-indigo-100 text-indigo-900"
                    value={selectedTool}
                    onChange={(e) => setSelectedTool(e.target.value as ToolOption)}
                  >
                    {TOOL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="flex-1 rounded-r px-3 py-2 bg-indigo-100 text-indigo-900 focus:outline-none"
                    type="text"
                    placeholder={
                      selectedTool === "dns_list_records"
                        ? "Zone (e.g. example.com)"
                        : selectedTool === "user_get_summary"
                        ? "Email or query"
                        : "Domain"
                    }
                    value={toolInput}
                    onChange={(e) => setToolInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && toolInput && sendMessage()}
                    disabled={loading}
                  />
                </div>
                <button
                  className="w-full rounded bg-indigo-700 px-4 py-2 text-white font-bold"
                  onClick={sendMessage}
                  disabled={loading || !toolInput}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AfmGuardianChat;