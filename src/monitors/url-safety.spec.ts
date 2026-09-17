import { BadRequestException } from '@nestjs/common';
import { assertSafeUrl } from './url-safety.js';

describe('assertSafeUrl', () => {
  it('rejects localhost', async () => {
    await expect(assertSafeUrl('http://localhost:3000')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a private IP address', async () => {
    await expect(assertSafeUrl('http://127.0.0.1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects non-HTTP protocols', async () => {
    await expect(assertSafeUrl('ftp://8.8.8.8')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows a public IP address', async () => {
    await expect(assertSafeUrl('https://8.8.8.8')).resolves.toBeUndefined();
  });
});
