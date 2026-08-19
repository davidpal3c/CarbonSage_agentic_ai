import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  sendMessage: (message: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  sendMessage,
  disabled,
  placeholder = "Ask about freight emissions...",
}: ChatInputProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState<string>("");

  const handleSend = () => {
    if (input.trim() && !disabled) {
      sendMessage(input);
      setInput("");

      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.style.height = "auto";
          textAreaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();

      setTimeout(() => {
        textAreaRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background p-3">
      <textarea
        ref={textAreaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message CarbonSage"
        maxLength={4000}
        rows={1}
        className="max-h-32 min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border bg-muted px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
