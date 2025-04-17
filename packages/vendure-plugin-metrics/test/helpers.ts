import { Request } from 'express';

/**
 * Creates mock request objects from multiple IP addresses and device types
 * @param count Number of requests to generate (default: 1)
 * @returns Array of mock Express request objects
 */
export function createMockRequests(count = 1): Request[] {
  // Possible IP addresses
  const ipAddresses = [
    '192.168.1.42',
    '82.45.128.91',
    '104.28.32.168',
    '172.217.20.174',
    '54.239.28.85',
  ];
  // Realistic user agents for different device types
  const userAgents = [
    // Desktop - Windows/Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    // Desktop - Mac/Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    // Mobile - iPhone/Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
    // Mobile - Android/Chrome
    'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    // Tablet - iPad/Safari
    'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
  ];
  // Generate the requested number of mock requests
  const requests: Partial<Request>[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute the requests evenly among our IP addresses and user agents
    const ipIndex = i % ipAddresses.length;
    const uaIndex = i % userAgents.length;
    const mockRequest: Partial<Request> = {
      headers: {
        'x-forwarded-for': ipAddresses[ipIndex],
        'user-agent': userAgents[uaIndex],
        'vendure-token': 'default-channel',
      },
    };
    requests.push(mockRequest);
  }
  return requests as Request[];
}
