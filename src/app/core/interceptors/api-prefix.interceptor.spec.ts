import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiPrefixInterceptor } from './api-prefix.interceptor';
import {
  isLocalHost,
  getBackendApiUrl,
  GCP_PRODUCTION_API_URL,
  LOCAL_BACKEND_API_URL,
} from '../../../environments/environment';

describe('Environment resolution & apiPrefixInterceptor', () => {
  describe('isLocalHost', () => {
    it('identifies localhost addresses correctly', () => {
      expect(isLocalHost('localhost')).toBe(true);
      expect(isLocalHost('127.0.0.1')).toBe(true);
      expect(isLocalHost('127.0.0.2')).toBe(true);
      expect(isLocalHost('0.0.0.0')).toBe(true);
      expect(isLocalHost('[::1]')).toBe(true);
      expect(isLocalHost('my-laptop.local')).toBe(true);
      expect(isLocalHost('test.internal')).toBe(true);
      expect(isLocalHost('192.168.1.25')).toBe(true);
      expect(isLocalHost('10.0.0.1')).toBe(true);
      expect(isLocalHost('172.20.0.5')).toBe(true);
    });

    it('identifies remote production domains correctly', () => {
      expect(isLocalHost('dhan-trader-514002.web.app')).toBe(false);
      expect(isLocalHost('dhan-trader-514002.firebaseapp.com')).toBe(false);
      expect(isLocalHost('trader.mydomain.com')).toBe(false);
    });
  });

  describe('getBackendApiUrl', () => {
    it('returns local backend URL when running locally', () => {
      expect(getBackendApiUrl()).toBe(LOCAL_BACKEND_API_URL);
    });
  });

  describe('apiPrefixInterceptor', () => {
    let httpClient: HttpClient;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([apiPrefixInterceptor])),
          provideHttpClientTesting(),
        ],
      });

      httpClient = TestBed.inject(HttpClient);
      httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpTesting.verify();
    });

    it('should prefix relative /api URLs with local backend URL when running locally', () => {
      httpClient.get('/api/orders').subscribe();

      const req = httpTesting.expectOne((request) =>
        request.url === `${LOCAL_BACKEND_API_URL}/api/orders`
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should prefix relative /health URLs with local backend URL when running locally', () => {
      httpClient.get('/health').subscribe();

      const req = httpTesting.expectOne((request) =>
        request.url === `${LOCAL_BACKEND_API_URL}/health`
      );
      expect(req.request.method).toBe('GET');
      req.flush({ status: 'ok' });
    });

    it('should redirect GCP Cloud Run URL to local backend when running locally', () => {
      const gcpUrl = `${GCP_PRODUCTION_API_URL}/api/positions`;
      httpClient.get(gcpUrl).subscribe();

      const req = httpTesting.expectOne((request) =>
        request.url === `${LOCAL_BACKEND_API_URL}/api/positions`
      );
      expect(req.request.method).toBe('GET');
      req.flush({ positions: [] });
    });

    it('should leave non-GCP absolute URLs unchanged', () => {
      const externalUrl = 'https://api.dhan.co/v2/alerts/orders';
      httpClient.get(externalUrl).subscribe();

      const req = httpTesting.expectOne(externalUrl);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });
});
