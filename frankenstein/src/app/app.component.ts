import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { ConfigService } from './core/services/config.service';
import { LayoutService } from './core/services/layout.service';

import { HeaderComponent } from './shared/layout/header/header.component';
import { FooterComponent } from './shared/layout/footer/footer.component';
import { TicketWidgetComponent } from './tools/ticket-widget/ticket-widget.component';
import { CahierRecetteWidgetComponent } from './tools/cahier-recette/cahier-recette-widget.component';
import { WoTchatIaWidgetComponent } from './tools/wo/wo-tchat-ia/wo-tchat-ia-widget.component';
import { WoActionsWidgetComponent } from './tools/wo/wo-actions/wo-actions-widget.component';
import { WoToolsPanelComponent } from './tools/wo/wo-tools-panel/wo-tools-panel.component';
import { WorgHelpDrawerComponent } from './shared/help/worg-help-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    TicketWidgetComponent,
    CahierRecetteWidgetComponent,
    WoTchatIaWidgetComponent,
    WoActionsWidgetComponent,
    WoToolsPanelComponent,
    WorgHelpDrawerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  @ViewChild(WoToolsPanelComponent) toolsPanel?: WoToolsPanelComponent;

  constructor(
    private themeService: ThemeService,
    public auth: AuthService,
    public configService: ConfigService,
    public layoutService: LayoutService
  ) {}

  ngOnInit() {
    this.themeService.initTheme();
    if (this.auth.getToken()) {
      this.auth.verify().catch(() => {});
    }
  }

  openToolsPanel() {
    this.toolsPanel?.open();
  }
}
