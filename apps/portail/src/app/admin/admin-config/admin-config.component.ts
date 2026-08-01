import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuntimeInfoService, LAUNCH_MODES } from '@portail/shared-ui';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-config.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminConfigComponent {
  protected readonly runtime = inject(RuntimeInfoService);
  protected readonly launchModes = LAUNCH_MODES;

  retry(): void {
    this.runtime.retryProbe();
  }
}
