export type UnifiedMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type UnifiedMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: UnifiedMessagePart[];
  name?: string;
  tool_call_id?: string;
};

export type ResponseFormat = {
  type?: 'text' | 'json_schema';
  json_schema?: Record<string, unknown>;
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GenerationParams = {
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  seed?: number;
  stop?: string[];
  response_format?: ResponseFormat;
  tools?: ToolSpec[];
};

export type RoutingConstraints = {
  budget?: {
    max_cost_usd?: number;
    max_latency_ms?: number;
  };
  routing?: {
    strategy?: 'cost' | 'latency' | 'reliability' | 'quality';
    allow_providers?: string[];
    deny_providers?: string[];
  };
  region?: {
    data_residency?: string;
  };
};

export type UnifiedRequest = {
  model: string;
  input: {
    messages?: UnifiedMessage[];
    prompt?: string;
  };
  generation?: GenerationParams;
  constraints?: RoutingConstraints;
  stream?: boolean;
  webhook_url?: string;
  metadata?: Record<string, unknown>;
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type UnifiedOutput = {
  type: 'message' | 'tool_call';
  message?: UnifiedMessage;
  tool_call?: {
    id: string;
    name: string;
    arguments_json: Record<string, unknown>;
  };
};

export type UnifiedResponse = {
  id: string;
  object: 'response';
  created: number;
  model: string;
  provider?: {
    name?: string;
    model?: string;
    region?: string;
  };
  outputs: UnifiedOutput[];
  usage?: Usage;
  request_id: string;
  metadata?: Record<string, unknown>;
};

export type SSEEvent = {
  type:
    | 'response.created'
    | 'response.delta'
    | 'response.usage'
    | 'response.completed'
    | 'response.failed';
  data: Record<string, unknown>;
};
