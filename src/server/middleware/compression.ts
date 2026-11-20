import express from 'express';
import zlib from 'zlib';

const MIN_COMPRESS_BYTES = 1024;
const COMPRESSIBLE_CONTENT_TYPE = /^(?:text\/|application\/(?:json|javascript|xml|x-javascript|manifest\+json)|image\/svg\+xml)/i;

function selectEncoding(acceptEncodingHeader: string | undefined): 'br' | 'gzip' | null {
  if (!acceptEncodingHeader) return null;
  const header = acceptEncodingHeader.toLowerCase();
  if (header.includes('br')) return 'br';
  if (header.includes('gzip')) return 'gzip';
  return null;
}

function shouldSkipCompression(req: express.Request, res: express.Response): boolean {
  if (req.method === 'HEAD' || req.method === 'OPTIONS') return true;
  if (req.headers.range) return true;
  if (req.path.startsWith('/api/v1/sse') || req.originalUrl.startsWith('/api/v1/sse')) return true;
  if (res.getHeader('Content-Encoding')) return true;
  if (res.statusCode === 204 || res.statusCode === 304) return true;
  const ct = String(res.getHeader('Content-Type') || '');
  if (!ct || ct.toLowerCase().includes('text/event-stream')) return true;
  return !COMPRESSIBLE_CONTENT_TYPE.test(ct);
}

/**
 * Lightweight zero-dependency Brotli / Gzip HTTP compression middleware.
 * Compresses JSON APIs & static text/JS/CSS responses >= 1 KB while never buffering SSE streams.
 */
export function httpCompressionMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const encoding = selectEncoding(req.headers['accept-encoding']);
  if (!encoding || req.path.startsWith('/api/v1/sse')) {
    return next();
  }

  const originalSend = res.send.bind(res);
  (res as any).send = (body?: any) => {
    if (body === undefined || body === null || res.headersSent) {
      return originalSend(body);
    }

    let buf: Buffer | null = null;
    if (Buffer.isBuffer(body)) {
      buf = body;
    } else if (typeof body === 'string') {
      buf = Buffer.from(body, 'utf8');
    } else {
      return originalSend(body);
    }

    if (buf.length < MIN_COMPRESS_BYTES || shouldSkipCompression(req, res)) {
      return originalSend(body);
    }

    const done = (err: Error | null, compressed: Buffer) => {
      if (err || !compressed || compressed.length >= buf!.length || res.headersSent) {
        return originalSend(body);
      }
      res.setHeader('Content-Encoding', encoding);
      res.vary('Accept-Encoding');
      res.removeHeader('Content-Length');
      res.setHeader('Content-Length', String(compressed.length));
      return originalSend(compressed);
    };

    if (encoding === 'br') {
      zlib.brotliCompress(
        buf,
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
          },
        },
        done
      );
      return res;
    }

    zlib.gzip(buf, { level: 6 }, done);
    return res;
  };

  next();
}
