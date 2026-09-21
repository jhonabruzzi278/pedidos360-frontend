import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';

interface WorkOrder { id: string; clientId: string; licensePlate: string; description: string; total: number; itemCount: number; calculatedSubtotal: number; }
interface AuditEvent { id: number; workOrderId: string; eventType: string; createdAt: string; }

@Component({ selector: 'app-dashboard', templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
export class Dashboard implements OnInit {
  readonly orders = signal<WorkOrder[]>([]);
  readonly events = signal<AuditEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor(private http: HttpClient, readonly auth: AuthService) {}
  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      const [orders, events] = await Promise.all([
        firstValueFrom(this.http.get<WorkOrder[]>(`${environment.apiBaseUrl}/api/work-orders`)),
        firstValueFrom(this.http.get<AuditEvent[]>(`${environment.apiBaseUrl}/api/events`)),
      ]);
      this.orders.set(orders); this.events.set(events);
    } catch { this.error.set('No fue posible consultar el BFF. Confirma que los tres procesos Spring Boot esten activos.'); }
    finally { this.loading.set(false); }
  }
  logout(): void { void this.auth.logout(); }
}
