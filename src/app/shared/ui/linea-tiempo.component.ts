import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EntradaLinea, QUIEN } from '../utils/linea-tiempo.util';
import { TEXTO_ZONA_NEGOCIO, cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

/** Estatus e incidencias ya ocurridos en un viaje, con hora del negocio y quién los puso. */
@Component({
  selector: 'app-linea-tiempo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Línea de tiempo</h2>
    <p class="texto-suave">Horas en {{ TEXTO_ZONA }}.</p>
    <ol class="linea">
      @for (e of entradas(); track e.clave) {
        <li class="linea-item" [class.linea-incidencia]="e.tipo === 'incidencia'" [class.linea-provisional]="e.marca">
          <span class="linea-hora" [title]="fechaHora(e.ocurrioEn)">{{ cuando(e.ocurrioEn) }}</span>
          <span class="linea-texto">{{ e.texto }}</span>
          <span class="linea-quien">{{ QUIEN[e.autor] }}{{ e.marca ? ' · ' + e.marca : '' }}</span>
          @if (e.nota) {
            <span class="linea-nota">“{{ e.nota }}”</span>
          }
        </li>
      } @empty {
        <li class="texto-suave">Sin movimientos todavía.</li>
      }
    </ol>
  `,
  styles: `
    .linea {
      list-style: none;
      margin: 0;
      padding: 0 0 0 18px;
      border-left: 4px solid var(--c-borde);
    }
    .linea-item {
      position: relative;
      display: grid;
      gap: 2px;
      padding: 0 0 16px 12px;
    }
    .linea-item::before {
      content: '';
      position: absolute;
      left: -29px;
      top: 4px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--c-primario);
      border: 3px solid var(--c-fondo);
    }
    .linea-incidencia::before {
      background: var(--c-aviso);
      border-color: #000;
    }
    .linea-provisional::before {
      background: var(--c-fondo);
      border-color: var(--c-primario);
    }
    .linea-hora {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--c-texto-suave);
    }
    .linea-texto {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .linea-quien {
      font-size: 0.95rem;
    }
    .linea-nota {
      font-style: italic;
    }
  `,
})
export class LineaTiempoComponent {
  readonly entradas = input.required<EntradaLinea[]>();
  protected readonly QUIEN = QUIEN;
  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly cuando = (iso: string) => cuandoNegocio(iso);
  protected readonly fechaHora = fechaHoraNegocio;
}
