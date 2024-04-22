import { Transform } from 'stream';

export class SSEStream extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
    });
  }

  _transform(data: { type?: string; message: any }, _encoding: any, done: any) {
    data.type && this.push(`event: ${data.type}\n`);
    this.push(`data: ${JSON.stringify({ message: data.message })}\n\n`);
    done();
  }
}
