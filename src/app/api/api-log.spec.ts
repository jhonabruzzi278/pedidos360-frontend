import { TestBed } from '@angular/core/testing';
import { makeResult } from '../testing/quote-fixtures';
import { ApiLog } from './api-log';

describe('ApiLog', () => {
  it('starts empty', () => {
    expect(TestBed.inject(ApiLog).results()).toEqual([]);
  });

  it('keeps the latest result of each route', () => {
    const log = TestBed.inject(ApiLog);
    log.record(makeResult('GET /api/work-orders', 200, []));
    log.record(makeResult('POST /api/work-orders', 403, null, { error: 'access_required' }));
    log.record(makeResult('POST /api/work-orders', 201, null));

    expect(log.results().map((r) => `${r.route} ${r.status}`)).toEqual(['GET /api/work-orders 200', 'POST /api/work-orders 201']);
  });

  it('can be cleared', () => {
    const log = TestBed.inject(ApiLog);
    log.record(makeResult('GET /api/events', 200, []));
    log.clear();
    expect(log.results()).toEqual([]);
  });
});
