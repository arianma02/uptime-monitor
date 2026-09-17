import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';

export async function assertSafeUrl(urlString: string): Promise<void> {
  const url = new URL(urlString);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only HTTP and HTTPS URLs are allowed');
  }

  if (url.hostname === 'localhost') {
    throw new BadRequestException('Local addresses are not allowed');
  }

  // Resolve the hostname and block any destination that points to a local/private network.
  const addresses = await lookup(url.hostname, { all: true });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BadRequestException(
        'Private network addresses are not allowed',
      );
    }
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;

    // Block loopback, private, link-local, and other non-public IPv4 ranges.
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();

    // Block loopback, private, and link-local IPv6 ranges.
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }

  return true;
}
