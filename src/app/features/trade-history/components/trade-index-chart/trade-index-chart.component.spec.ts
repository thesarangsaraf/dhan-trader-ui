import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoricalDataService } from '../../../../core/api/historical-data.service';
import {
  TradeIndexChartComponent,
  buildTradeMarkersAndPlots,
  parseIstTimeToEpoch,
} from './trade-index-chart.component';

const mockPriceRange = { from: 24400, to: 24600 };
const mockLogicalRange = { from: 10, to: 90 };
let mockAutoScale = true;

const mockPriceScaleApi = {
  applyOptions: vi.fn((opts: { autoScale?: boolean }) => {
    if (opts.autoScale !== undefined) mockAutoScale = opts.autoScale;
  }),
  options: vi.fn(() => ({ autoScale: mockAutoScale })),
  width: vi.fn(() => 60),
  getVisibleRange: vi.fn(() => ({ ...mockPriceRange })),
  setVisibleRange: vi.fn((range: { from: number; to: number }) => {
    mockAutoScale = false;
    mockPriceRange.from = range.from;
    mockPriceRange.to = range.to;
  }),
  setAutoScale: vi.fn((on: boolean) => {
    mockAutoScale = on;
  }),
};

const mockTimeScaleApi = {
  fitContent: vi.fn(),
  setVisibleRange: vi.fn(),
  getVisibleLogicalRange: vi.fn(() => ({ ...mockLogicalRange })),
  setVisibleLogicalRange: vi.fn((range: { from: number; to: number }) => {
    mockLogicalRange.from = range.from;
    mockLogicalRange.to = range.to;
  }),
};

const mockSeriesApi = {
  setData: vi.fn(),
  createPriceLine: vi.fn(() => ({ id: Math.random() })),
  removePriceLine: vi.fn(),
};

const mockChartApi = {
  addSeries: vi.fn(() => mockSeriesApi),
  priceScale: vi.fn(() => mockPriceScaleApi),
  timeScale: vi.fn(() => mockTimeScaleApi),
  resize: vi.fn(),
  remove: vi.fn(),
};

describe('TradeIndexChartComponent', () => {
  let fixture: ComponentFixture<TradeIndexChartComponent>;
  let component: TradeIndexChartComponent;
  let makeChartSpy: ReturnType<typeof vi.spyOn>;
  let attachMarkersSpy: ReturnType<typeof vi.spyOn>;

  const entryEpoch = parseIstTimeToEpoch('2026-05-10T10:00:00')!;
  const exitEpoch = parseIstTimeToEpoch('2026-05-10T10:15:00')!;

  const mockHistoricalDataService = {
    getCandles: vi.fn(() =>
      of({
        success: true,
        symbol: 'NIFTY 50',
        timeframe: '5m',
        monthsRead: ['2026-05'],
        count: 2,
        candles: [
          {
            epoch: entryEpoch,
            timestampIST: '2026-05-10T10:00:00',
            open: 24450,
            high: 24520,
            low: 24430,
            close: 24500,
            volume: 0,
          },
          {
            epoch: exitEpoch,
            timestampIST: '2026-05-10T10:15:00',
            open: 24500,
            high: 24590,
            low: 24490,
            close: 24575,
            volume: 0,
          },
        ],
      }),
    ),
    getBankNiftyCandles: vi.fn(() => of({ success: true, candles: [] })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAutoScale = true;
    mockPriceRange.from = 24400;
    mockPriceRange.to = 24600;
    mockLogicalRange.from = 10;
    mockLogicalRange.to = 90;

    makeChartSpy = vi
      .spyOn(TradeIndexChartComponent.prototype as any, 'makeChart')
      .mockReturnValue(mockChartApi);
    attachMarkersSpy = vi
      .spyOn(TradeIndexChartComponent.prototype as any, 'attachSeriesMarkers')
      .mockImplementation(() => {});

    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    await TestBed.configureTestingModule({
      imports: [TradeIndexChartComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: HistoricalDataService, useValue: mockHistoricalDataService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TradeIndexChartComponent);
    component = fixture.componentInstance;

    const containerEl = component.chartContainerRef.nativeElement;
    vi.spyOn(containerEl, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(containerEl, 'clientHeight', 'get').mockReturnValue(500);
    vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 960,
      bottom: 500,
      width: 960,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    component.tradeInput = {
      tradeId: 'PAIR-1',
      symbol: 'NIFTY 28 NOV 24500 CALL',
      securityId: '45021',
      quantity: 50,
      buyPrice: 130,
      sellPrice: 145,
      pnl: 750,
      pnlPercentage: 11.54,
      status: 'CLOSED',
      isProfit: true,
      tradeDate: '2026-05-10',
      executionTime: '2026-05-10T10:15:00',
      buyTime: '2026-05-10T10:00:00',
      sellTime: '2026-05-10T10:15:00',
    };
    component.ngOnChanges({
      tradeInput: {
        currentValue: component.tradeInput,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    fixture.detectChanges();
  });

  it('should configure official TradingView-style handleScroll, handleScale, and autoScale options', () => {
    expect(makeChartSpy).toHaveBeenCalledTimes(1);
    const chartOptions = (makeChartSpy.mock.calls[0] as any[])[1];
    expect(chartOptions.rightPriceScale.autoScale).toBe(true);
    expect(chartOptions.handleScroll).toEqual({
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    });
    expect(chartOptions.handleScale).toEqual({
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
      axisDoubleClickReset: {
        time: true,
        price: true,
      },
    });
  });

  it('should allow native TradingView time zoom/scroll when wheel occurs over the main chart plot', () => {
    const containerEl = component.chartContainerRef.nativeElement;
    const wheelOverPlot = new WheelEvent('wheel', {
      deltaY: 120,
      deltaX: 0,
      clientX: 400,
      clientY: 250,
      cancelable: true,
      bubbles: true,
    });
    containerEl.dispatchEvent(wheelOverPlot);

    expect(wheelOverPlot.defaultPrevented).toBe(false);
    expect(mockPriceScaleApi.setVisibleRange).not.toHaveBeenCalled();
  });

  it('should scale the right price axis when scrolling wheel over the price scale column', () => {
    const containerEl = component.chartContainerRef.nativeElement;
    const initialSpan = mockPriceRange.to - mockPriceRange.from;

    // Scroll down over right price axis (x = 930 >= 960 - 60) -> expands price span
    const wheelDownOverAxis = new WheelEvent('wheel', {
      deltaY: 100,
      deltaX: 0,
      clientX: 930,
      clientY: 250,
      cancelable: true,
      bubbles: true,
    });
    containerEl.dispatchEvent(wheelDownOverAxis);

    expect(wheelDownOverAxis.defaultPrevented).toBe(true);
    expect(mockPriceScaleApi.setVisibleRange).toHaveBeenCalled();
    expect(mockPriceRange.to - mockPriceRange.from).toBeGreaterThan(initialSpan);
    expect(component.isAutoScale()).toBe(false);

    // Scroll up over right price axis -> compresses price span
    const expandedSpan = mockPriceRange.to - mockPriceRange.from;
    const wheelUpOverAxis = new WheelEvent('wheel', {
      deltaY: -100,
      deltaX: 0,
      clientX: 930,
      clientY: 250,
      cancelable: true,
      bubbles: true,
    });
    containerEl.dispatchEvent(wheelUpOverAxis);

    expect(mockPriceRange.to - mockPriceRange.from).toBeLessThan(expandedSpan);
  });

  it('should pan horizontally on Shift + wheel when deltaX is zero', () => {
    const containerEl = component.chartContainerRef.nativeElement;
    const shiftWheel = new WheelEvent('wheel', {
      deltaY: 90,
      deltaX: 0,
      shiftKey: true,
      clientX: 400,
      clientY: 250,
      cancelable: true,
      bubbles: true,
    });
    containerEl.dispatchEvent(shiftWheel);

    expect(shiftWheel.defaultPrevented).toBe(true);
    expect(mockTimeScaleApi.setVisibleLogicalRange).toHaveBeenCalled();
    expect(mockLogicalRange.from).toBeGreaterThan(10);
    expect(mockLogicalRange.to).toBeGreaterThan(90);
    expect(mockPriceScaleApi.setVisibleRange).not.toHaveBeenCalled();
  });

  it('should toggle autoScale via the Auto button', () => {
    expect(component.isAutoScale()).toBe(true);

    component.toggleAutoScale();
    expect(component.isAutoScale()).toBe(false);
    expect(mockPriceScaleApi.applyOptions).toHaveBeenCalledWith({ autoScale: false });

    component.toggleAutoScale();
    expect(component.isAutoScale()).toBe(true);
    expect(mockPriceScaleApi.applyOptions).toHaveBeenCalledWith({ autoScale: true });
  });

  it('should support zoomIn and zoomOut header actions', () => {
    component.zoomIn();
    const zoomedInSpan = mockLogicalRange.to - mockLogicalRange.from;
    expect(zoomedInSpan).toBeLessThan(80);

    component.zoomOut();
    const zoomedOutSpan = mockLogicalRange.to - mockLogicalRange.from;
    expect(zoomedOutSpan).toBeGreaterThan(zoomedInSpan);
  });

  it('should plot entry and exit markings for all trades of an instrument and allow focusing individual trades', () => {
    const t1 = {
      ...component.tradeInput!,
      tradeId: 'T-1',
      pnl: 750,
      buyTime: '2026-05-10T10:00:00',
      sellTime: '2026-05-10T10:15:00',
    };
    const t2 = {
      ...component.tradeInput!,
      tradeId: 'T-2',
      symbol: 'NIFTY 28 MAY 24600 PE',
      pnl: -300,
      buyTime: '2026-05-10T10:15:00',
      sellTime: '2026-05-10T10:00:00',
    };

    const candles = [
      {
        epoch: entryEpoch,
        timestampIST: '2026-05-10T10:00:00',
        open: 24450,
        high: 24520,
        low: 24430,
        close: 24500,
        volume: 0,
      },
      {
        epoch: exitEpoch,
        timestampIST: '2026-05-10T10:15:00',
        open: 24500,
        high: 24590,
        low: 24490,
        close: 24575,
        volume: 0,
      },
    ];

    const built = buildTradeMarkersAndPlots([t1, t2], candles, false);
    expect(built.plots.length).toBe(2);
    expect(built.markers.length).toBe(4);
    expect(built.markers[0].text).toContain('#1');
    expect(built.markers.some((m) => m.text.includes('#2'))).toBe(true);

    attachMarkersSpy.mockClear();
    mockSeriesApi.createPriceLine.mockClear();

    component.tradeInput = null;
    component.instrumentTradesInput = [t1, t2];
    component.chartModeInput = 'all';
    component.instrumentKeyInput = 'NIFTY50';
    component.ngOnChanges({
      instrumentTradesInput: {
        currentValue: component.instrumentTradesInput,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
      chartModeInput: {
        currentValue: 'all',
        previousValue: 'single',
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    expect(component.isAllTradesMode()).toBe(true);
    expect(component.plottedTrades().length).toBe(2);
    expect(component.aggregateSummary()).toEqual({
      totalTrades: 2,
      totalPnl: 450,
      wins: 1,
      losses: 1,
    });
    expect(attachMarkersSpy).toHaveBeenCalledTimes(1);
    const plottedMarkers = attachMarkersSpy.mock.calls[0][1] as any[];
    expect(plottedMarkers.length).toBe(4);
    // In all-trades overview, price lines are deferred until a trade is focused
    expect(mockSeriesApi.createPriceLine).not.toHaveBeenCalled();

    component.focusTradeByIndex(0);
    expect(component.focusedTradeIndex()).toBe(0);
    expect(mockSeriesApi.createPriceLine).toHaveBeenCalledTimes(2);
    expect(mockTimeScaleApi.setVisibleRange).toHaveBeenCalled();

    component.stepFocusedTrade(1);
    expect(component.focusedTradeIndex()).toBe(1);
    expect(mockSeriesApi.removePriceLine).toHaveBeenCalled();
  });
});
