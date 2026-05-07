"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ivan-messages");
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([
        {
          role: "assistant",
          content: "你好，momo。\n我是伊万。\n不管你带着什么来，这里都有时间听。\n你现在想说什么？",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("ivan-messages", JSON.stringify(messages));
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value);
      setMessages([...newMessages, { role: "assistant", content: fullText }]);
    }

    setLoading(false);
  };

  const clearChat = () => {
    localStorage.removeItem("ivan-messages");
    setMessages([
      {
        role: "assistant",
        content: "你好，momo。\n我是伊万。\n不管你带着什么来，这里都有时间听。\n你现在想说什么？",
      },
    ]);
  };

  const exportChat = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `伊万对话_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setMessages(imported);
          localStorage.setItem("ivan-messages", JSON.stringify(imported));
        }
      } catch {
        // ignore malformed files
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-[#fdf6ec] flex flex-col items-center">
      {/* 顶栏 */}
      <div className="w-full max-w-3xl flex items-center justify-between px-6 py-4 border-b border-[#e8ddd0]">
        <div>
          <h1 className="text-lg font-medium text-[#5c4a3a]">伊万</h1>
          <p className="text-xs text-[#a89080]">你的情绪疏导员</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs text-[#a89080] hover:text-[#5c4a3a] transition-colors cursor-pointer">
            导入对话
            <input type="file" accept=".json" onChange={importChat} className="hidden" />
          </label>
          <button
            onClick={exportChat}
            disabled={messages.length <= 1}
            className="text-xs text-[#a89080] hover:text-[#5c4a3a] transition-colors disabled:opacity-30"
          >
            导出对话
          </button>
          <button
            onClick={clearChat}
            className="text-xs text-[#a89080] hover:text-[#5c4a3a] transition-colors"
          >
            新的对话
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#e8ddd0] flex items-center justify-center text-xs text-[#5c4a3a] mr-3 mt-1 flex-shrink-0">
                伊
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#5c4a3a] text-[#fdf6ec] rounded-tr-sm"
                  : "bg-white text-[#3a2e26] rounded-tl-sm shadow-sm"
              }`}
            >
              {msg.content}
              {loading && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="inline-block w-1 h-3 bg-[#a89080] ml-1 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="w-full max-w-3xl px-6 py-4 border-t border-[#e8ddd0] bg-[#fdf6ec]">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="跟伊万说说……"
            rows={1}
            className="flex-1 resize-none bg-white border border-[#e8ddd0] rounded-xl px-4 py-3 text-sm text-[#3a2e26] placeholder-[#c4b5a8] focus:outline-none focus:border-[#a89080] transition-colors"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-[#5c4a3a] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#3a2e26] transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-[#c4b5a8] mt-3">
          伊万不能替代专业心理帮助 · 危机请拨 400-161-9995
        </p>
        <p className="text-center text-xs text-[#c4b5a8] mt-1">
          有任何想说的 · 加QQ群：233792448
        </p>
      </div>
    </div>
  );
}
