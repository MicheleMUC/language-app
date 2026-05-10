import type { WsClientMessage, WsServerMessage } from "@/types";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

export class ConversationSocket {
  private ws: WebSocket | null = null;
  private onMessage: (msg: WsServerMessage) => void;
  private onClose: () => void;

  constructor(
    onMessage: (msg: WsServerMessage) => void,
    onClose: () => void
  ) {
    this.onMessage = onMessage;
    this.onClose = onClose;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
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

  sendAudio(base64: string) {
    this.send({ type: "audio", data: base64 });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
