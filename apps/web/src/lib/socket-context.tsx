"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { ChatSocket } from "@/lib/websocket";
import { refreshAction } from "@/lib/actions/auth";

interface SocketContextValue {
  socket: ChatSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, updateAccessToken, logout } = useAuth();
  const socketRef = useRef<ChatSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleUnauthorized = useCallback(async () => {
    const result = await refreshAction();
    if (result) {
      updateAccessToken(result.accessToken);
      socketRef.current?.updateToken(result.accessToken);
      socketRef.current?.reconnect();
    } else {
      logout();
    }
  }, [updateAccessToken, logout]);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = new ChatSocket(accessToken);
    socketRef.current = socket;

    const unsubConnected = socket.on("_connected", () => setIsConnected(true));
    const unsubDisconnected = socket.on("_disconnected", () => setIsConnected(false));
    const unsubUnauthorized = socket.on("_unauthorized", () => {
      setIsConnected(false);
      handleUnauthorized();
    });

    socket.connect();

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubUnauthorized();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [accessToken, handleUnauthorized]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
