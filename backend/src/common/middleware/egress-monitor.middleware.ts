import { Request, Response, NextFunction } from 'express';

export const egressMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  let responseBytes = 0;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk: any, ...args: any[]): boolean {
    if (chunk) {
      responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    return (originalWrite as any).apply(res, [chunk, ...args]);
  };

  res.end = function (chunk: any, ...args: any[]): any {
    if (chunk) {
      responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }

    const duration = Date.now() - startTime;
    const kb = (responseBytes / 1024).toFixed(1);

    // Egress warning threshold: 200 KB
    if (responseBytes > 200 * 1024) {
      console.warn(
        `⚠️ [EGRESS WARNING] Large Response: ${req.method} ${req.originalUrl || req.url} | Size: ${kb} KB (${responseBytes} bytes) | Duration: ${duration}ms`
      );
    }

    return (originalEnd as any).apply(res, [chunk, ...args]);
  };

  next();
};
