export interface WsClovekData {
  version?: string;
  state: SocketState;
  downloading: boolean;
  progress?: number;
  eta?: string;
}

export enum SocketState {
  handshake,
  downloading
}

export interface JSONData {
  id: number,
  version?: string;
}
