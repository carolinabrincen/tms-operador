import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { SugerenciaAcuse, sugerenciasAcuse } from '../utils/evidencias.util';
import { HojaFotoComponent } from './hoja-foto.component';

/**
 * Después de reportar Descargado: "Tomar foto del acuse de recibido", ligada a ese reporte. Solo una sugerencia
 * ("Ahora no" la quita); no obliga a nada.
 */
@Component({
  selector: 'app-sugerencia-acuse',
  imports: [HojaFotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (s of sugerencias(); track s.reporteId) {
      <section class="tarjeta tarjeta-destacada sugerencia-acuse" role="note">
        <p><strong>Viaje {{ s.viaje.orden }}: ya reportó “Ya descargué”.</strong> Si tiene el acuse de recibido firmado, tómele una foto.</p>
        <div class="acciones">
          <button type="button" class="btn btn-primario btn-bloque tomar-acuse" (click)="abierta.set(s)">Tomar foto del acuse de recibido</button>
          <button type="button" class="btn btn-texto btn-bloque ahora-no" (click)="omitir(s)">Ahora no</button>
        </div>
      </section>
    }
    @if (abierta(); as s) {
      <app-hoja-foto [viaje]="s.viaje" tipoInicial="AcuseRecibido" [reporteId]="s.reporteId" (cerrar)="abierta.set(null)" />
    }
  `,
})
export class SugerenciaAcuseComponent {
  readonly viajes = input.required<readonly Viaje[]>();

  private readonly reportes = inject(ColaReportesService);
  private readonly fotos = inject(ColaEvidenciasService);

  protected readonly abierta = signal<SugerenciaAcuse | null>(null);
  protected readonly sugerencias = computed(() =>
    sugerenciasAcuse(this.viajes(), this.reportes.reportes(), this.fotos.fotos(), this.fotos.sugerenciasOmitidas()),
  );

  protected omitir(s: SugerenciaAcuse): void {
    this.fotos.omitirSugerencia(s.reporteId);
  }
}
