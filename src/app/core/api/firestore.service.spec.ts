import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FirestoreApiService } from './firestore.service';

describe('FirestoreApiService', () => {
  let service: FirestoreApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FirestoreApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FirestoreApiService);
    httpTesting = TestBed.inject(HttpTestingController);

    // Initial constructor call
    const initReq = httpTesting.expectOne('/api/firestore/status');
    initReq.flush({
      configured: true,
      projectId: 'dhan-trader-514002',
      databaseId: 'dhan-trader-firebase-db',
    });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should initialize and report Firestore status', () => {
    expect(service.status()?.configured).toBe(true);
    expect(service.status()?.projectId).toBe('dhan-trader-514002');
  });

  it('should run connectivity test', () => {
    let result: any;
    service.testConnection().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/firestore/test');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      message: 'Connected',
      projectId: 'dhan-trader-514002',
      databaseId: 'dhan-trader-firebase-db',
      latencyMs: 12,
      collections: ['orders'],
    });

    expect(result?.success).toBe(true);
    expect(service.lastTestResult()?.latencyMs).toBe(12);
  });
});
