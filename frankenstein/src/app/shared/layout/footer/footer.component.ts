import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';
import { environment } from '../../../../environments/environment';

const API = environment.apiDataUrl;

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
})
export class FooterComponent implements OnInit {
  @Input() onOpenTools?: () => void;

  readonly appName = environment.appName;
  readonly copyrightYear = environment.copyrightYear;
  readonly copyrightHolder = environment.copyrightHolder;
  readonly copyrightTagline = environment.copyrightTagline;

  versionStatus = signal<{ upToDate: boolean; localVersion: string; latestDeployment: any } | null>(null);

  constructor(
    public auth: AuthService,
    public configService: ConfigService
  ) {}

  ngOnInit() {
    this.checkVersion();
  }

  async checkVersion() {
    try {
      const res = await fetch(`${API}/api/version/check`);
      if (res.ok) this.versionStatus.set(await res.json());
    } catch { /* silencieux */ }
  }

  openToolsPanel(): void {
    if (this.onOpenTools) {
      this.onOpenTools();
    }
  }

  get activeToolsCount(): number {
    let count = 0;
    if (this.configService.tchatIaEnabled()) count++;
    if (this.configService.ticketsEnabled()) count++;
    if (this.configService.recetteWidgetEnabled()) count++;
    if (this.configService.actionsEnabled()) count++;
    return count;
  }
}
