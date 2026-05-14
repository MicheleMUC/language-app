import Constants from "expo-constants";
import type { WsClientMessage, WsServerMessage } from "@/types";

function getWsUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  const host = (Constants.expoConfig?.hostUri ?? "localhost:8081").split(":")[0];
  return `ws://${host}:3001/ws`;
}

export class ConversationSocket {
  private ws: WebSocket | null = null;
  private onMessage: (msg: WsServerMessage) => void;
  private onClose: () => void;

  constructor(onMessage: (msg: WsServerMessage) => void, onClose: () => void) {
    this.onMessage = onMessage;
    this.onClose = onClose;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getWsUrl();
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onclose = () => this.onClose();
      this.ws.onmessage = (e) => {
        try {
          const msg: WsServerMessage = JSON.parse(e.data as string);
          this.onMessage(msg);
        } catch {
          // ignore malformed frames
        }
      };
    });
  }

  send(msg: WsClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
