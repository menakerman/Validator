import type { IncomingMessage, ServerResponse } from 'node:http';

export declare const PROTOCOL_PATH: string;
export declare function handleProtocolRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void>;
