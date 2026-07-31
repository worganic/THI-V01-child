import { Component, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  HeaderComponent, FooterComponent,
  TicketWidgetComponent, CahierRecetteWidgetComponent,
  WoTchatIaWidgetComponent, WoActionsWidgetComponent,
  WoToolsPanelComponent
} from '@portail/shared-ui';
import { LayoutService } from '@portail/core-data-access';
import { runtimeEnv } from './runtime-env';

@Component({
  imports: [
    RouterModule,
    HeaderComponent,
    FooterComponent,
    TicketWidgetComponent,
    CahierRecetteWidgetComponent,
    WoTchatIaWidgetComponent,
    WoActionsWidgetComponent,
    WoToolsPanelComponent
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  @ViewChild('toolsPanel') toolsPanel?: WoToolsPanelComponent;
  portailUrl = runtimeEnv.portailUrl;

  constructor(public layoutService: LayoutService) {}

  openToolsPanel() {
    this.toolsPanel?.open();
  }
}
