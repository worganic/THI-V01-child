import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuntimeInfoService } from '../service/runtime-info.service';
import { LAUNCH_MODES } from '../service/launch-modes';

@Component({
  selector: 'lib-backend-unavailable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backend-unavailable.component.html',
  styleUrls: ['./backend-unavailable.component.scss'],
})
export class BackendUnavailableComponent {
  protected readonly runtime = inject(RuntimeInfoService);
  protected readonly launchModes = LAUNCH_MODES;

  retry(): void {
    this.runtime.retryProbe();
  }
}
