import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SectionErrorComponent } from './section-error.component';

describe('SectionErrorComponent', () => {
  let component: SectionErrorComponent;
  let fixture: ComponentFixture<SectionErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionErrorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SectionErrorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Failed to load positions');
    fixture.componentRef.setInput('message', 'Backend server not available (127.0.0.1:8000)');
    fixture.detectChanges();
  });

  it('should render section error title and message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.error-title')?.textContent).toContain('Failed to load positions');
    expect(el.querySelector('.error-message')?.textContent).toContain('Backend server not available');
  });

  it('should emit retry event when retry button clicked', () => {
    let retried = false;
    component.retry.subscribe(() => (retried = true));

    const btn = fixture.nativeElement.querySelector('.retry-action-btn') as HTMLButtonElement;
    btn.click();
    expect(retried).toBe(true);
  });
});
