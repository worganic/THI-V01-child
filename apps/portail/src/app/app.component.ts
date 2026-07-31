import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';


import { ThemeService } from '@worganic/portail-core/data-access';
import { AuthService } from '@worganic/portail-core/data-access';
import { ConfigService } from '@worganic/portail-core/data-access';
import { LayoutService } from '@worganic/portail-core/data-access';
import { WoActionHistoryService } from '@worganic/portail-core/data-access';

import {
  HeaderComponent, FooterComponent,
  TicketWidgetComponent, CahierRecetteWidgetComponent,
  WoTchatIaWidgetComponent, WoActionsWidgetComponent,
  WoToolsPanelComponent
} from '@worganic/shared/ui';
import { navigateToApp } from './shared/utils/navigate-to-projets';
import { WorgHelpDrawerComponent } from './shared/help/worg-help-drawer.component';

@Component({
    selector: 'app-root',
    imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    TicketWidgetComponent,
    CahierRecetteWidgetComponent,
    WoTchatIaWidgetComponent,
    WoActionsWidgetComponent,
    WoToolsPanelComponent,
    WorgHelpDrawerComponent
],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  @ViewChild(WoToolsPanelComponent) toolsPanel?: WoToolsPanelComponent;
  /** Callback générique pour le clic sur une sous-appli externe dans la nav (voir NavComponent.onAppClick). */
  onAppClick = (url: string) => navigateToApp(url);

  constructor(
    private themeService: ThemeService,
    public auth: AuthService,
    public configService: ConfigService,
    public layoutService: LayoutService,
    private woActionHistory: WoActionHistoryService
  ) {}

  ngOnInit() {
    this.themeService.initTheme();
    if (this.auth.getToken()) {
      this.auth.verify().catch(() => {});
    }
    (window as any).WoActionHistory = {
      track: (ctx: any) => this.woActionHistory.track(ctx)
    };
  }

  openToolsPanel() {
    this.toolsPanel?.open();
  }
}
