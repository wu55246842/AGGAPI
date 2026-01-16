import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

export const initTelemetry = async () => {
  if (sdk) {
    return;
  }
  const exporterEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = exporterEndpoint
    ? new OTLPTraceExporter({ url: exporterEndpoint })
    : undefined;
  sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations(),
      new NestInstrumentation(),
    ],
  });
  await sdk.start();
};

export const shutdownTelemetry = async () => {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
};
