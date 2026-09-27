import { describe, expect, it } from 'vitest';

import { createCooldown } from './cooldown';

describe('createCooldown', () => {
  it('is true once per period', () => {
    let now = 1000;
    const ready = createCooldown(3000, () => now);
    expect(ready()).toBe(true);
    now += 500;
    expect(ready()).toBe(false);
    now += 2499;
    expect(ready()).toBe(false);
    now += 1;
    expect(ready()).toBe(true);
    expect(ready()).toBe(false);
  });
});
