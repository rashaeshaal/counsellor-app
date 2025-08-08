import { TestBed } from '@angular/core/testing';

import { ProblemApiService } from './problem-api.service';

describe('ProblemApiService', () => {
  let service: ProblemApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProblemApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
