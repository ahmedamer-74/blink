"use client";

interface DateDividerProps {
  date: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function DateDivider({ date }: DateDividerProps) {
  return (
    <div className="flex justify-center py-2">
      <span
        className="rounded-lg px-3 py-1 text-[12.5px] shadow-sm"
        style={{
          background: "var(--bubble-in)",
          color: "var(--text-secondary)",
        }}
      >
        {formatDate(date)}
      </span>
    </div>
  );
}
