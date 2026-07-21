"use client";

export default function ChatPage() {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg-chat)" }}>
      <div className="flex flex-col items-center text-center px-4 sm:px-8">
        <div className="mb-4 sm:mb-6 rounded-full p-4 sm:p-6" style={{ background: "rgba(0,168,132,0.08)" }}>
          <svg viewBox="0 0 303 172" className="h-[100px] w-[172px] sm:h-[172px] sm:w-[303px]" fill="none">
            <path
              d="M229.565 160.229c32.647-16.166 55.487-49.621 55.487-88.594C285.052 32.127 239.478 0 182.394 0 125.31 0 79.736 32.127 79.736 71.635c0 15.39 6.822 29.55 17.883 40.915-4.277 15.39-14.768 29.153-28.873 38.914 34.303-.197 65.618-16.068 85.806-40.915 6.527 1.38 13.252 2.173 20.168 2.173 3.663 0 7.27-.295 10.817-.883 24.605 20.077 55.684 31.394 89.257 31.394.593 0 1.185-.033 1.777-.096l-7.269 17.178z"
              fill="var(--accent)"
              fillOpacity="0.12"
            />
            <path
              d="M151.766 72.673c-29.168 0-52.82 22.276-52.82 49.743 0 27.467 23.652 49.743 52.82 49.743 29.167 0 52.82-22.276 52.82-49.743 0-27.467-23.653-49.743-52.82-49.743z"
              fill="var(--accent)"
              fillOpacity="0.2"
            />
            <path
              d="M151.766 104.35c-11.263 0-20.396 8.57-20.396 19.14 0 10.57 9.133 19.14 20.396 19.14s20.396-8.57 20.396-19.14c0-10.57-9.133-19.14-20.396-19.14z"
              fill="var(--accent)"
              fillOpacity="0.5"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl sm:text-[32px] font-light" style={{ color: "var(--text-primary)" }}>
          Blink
        </h2>
        <p className="max-w-md text-xs sm:text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Send and receive messages. Search for a user in the sidebar to start a new conversation.
        </p>
      </div>
    </div>
  );
}
