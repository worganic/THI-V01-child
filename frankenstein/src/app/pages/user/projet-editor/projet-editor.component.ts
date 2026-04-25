import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectService, Project } from '../../../core/services/project.service';
import { ConfigService } from '../../../core/services/config.service';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../core/services/layout.service';
import { ApiService } from '../../../core/services/api.service';

import { ProjetToolbarComponent } from './components/projet-toolbar/projet-toolbar.component';
import { ProjetSidebarComponent } from './components/projet-sidebar/projet-sidebar.component';
import { ProjetEditorZoneComponent } from './components/projet-editor-zone/projet-editor-zone.component';
import { ProjetConversationComponent } from './components/projet-conversation/projet-conversation.component';
import { ProjetStatusbarComponent } from './components/projet-statusbar/projet-statusbar.component';

const MOCK_CONTENT = `# Lorem ipsum >

Lorem ipsum dolor sit amet. Eos dolor laborum ut dolorum aperiam sit itaque itaque.

## Non maxime cupiditate est laudantium >

Lorem ipsum dolor sit amet. Eos dolor laborum ut dolorum aperiam sit itaque itaque. Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur. Sit illum facere sed voluptate voluptatibus et autem impedit ab odit sint sit sequi cupiditate et unde tempore est placeat modi.

Est soluta rerum est nostrum similique sit dolores nihil vel sequi quia quo voluptatum repellat sit temporibus laboriosam sit doloremque quos. Rem laboriosam odio qui laudantium reiciendis aut maxime molestias.

Id optio impedit qui quia porro et illum repellat est aliquid dolor At dolorum labore non dolorem ipsa. Non maxime cupiditate est laudantium dolores qui nisi quos ut suscipit facilis sit amet labore et dignissimos inventore? In ullam iure et praesentium totam et rerum eligendi et dolores vero qui ipsum ipsum est omnis voluptatem.

## Dolores nihil vel sequi quia quo voluptatu >

Lorem ipsum dolor sit amet. Eos dolor laborum ut dolorum aperiam sit itaque itaque.

- Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur.
- Sit illum facere sed voluptate voluptatibus et autem impedit ab odit sint sit sequi cupiditate et unde tempore est placeat modi.
- Est soluta rerum est nostrum similique sit dolores nihil vel sequi quia quo voluptatum repellat sit temporibus laboriosam sit doloremque quos.
- Rem laboriosam odio qui laudantium reiciendis aut maxime molestias.

Id optio impedit qui quia porro et illum repellat est aliquid dolor At dolorum labore non dolorem ipsa. Non maxime cupiditate est laudantium dolores qui nisi quos ut suscipit facilis sit amet labore et dignissimos inventore? In ullam iure et praesentium totam et rerum eligendi et dolores vero qui ipsum ipsum est omnis voluptatem.

## Nesciunt perferendis ut nulla perspiciatis >

Id possimus commodi eum autem beatae sed quam ipsum et maxime excepturi sed quod distinctio nam enim iure eos tempore adipisci.

1. Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur.
2. Sit illum facere sed voluptate voluptatibus et autem impedit ab odit sint sit sequi cupiditate et unde tempore est placeat modi.
3. Est soluta rerum est nostrum similique sit dolores nihil vel sequi quia quo voluptatum repellat sit temporibus laboriosam sit doloremque quos.
4. In explicabo magni qui rerum nostrum ut quasi minus

\`\`\`xml
<!-- In repellendus velit. -->
<velit>Est laudantium provident ut consequatur dolor.</velit>
<debitis>Sit rerum facilis.</debitis>
<quod>Sit ullam enim ut dolor nihil quo neque vero.</quod>
<veritatis>Ab perspiciatis doloribus.</veritatis>
\`\`\`

## Dolor sit amet >

Ut corporis obcaecati et enim culpa aut aspernatur harum id sequi molestiae et fugiat quae aut minima voluptatem. Est voluptates molestiae quo natus totam sed velit quasi et neque dolore ex fuga cumque. In facere eligendi ea voluptas perspiciatis aut necessitatibus facilis id sint voluptatibus ea laborum nihil et ipsa eligendi.

Aut numquam facilis cum corrupti molestiae id accusantium corrupti qui quia dolore! Ac debitis quo voluptate ratione qui vel fugiat totam aut minus blanditiis.
`;

@Component({
  selector: 'app-projet-editor',
  standalone: true,
  imports: [
    CommonModule,
    ProjetToolbarComponent,
    ProjetSidebarComponent,
    ProjetEditorZoneComponent,
    ProjetConversationComponent,
    ProjetStatusbarComponent,
  ],
  templateUrl: './projet-editor.component.html',
  styleUrl: './projet-editor.component.scss'
})
export class ProjetEditorComponent implements OnInit, OnDestroy {
  project = signal<Project | null>(null);
  loading = signal(true);
  isDirty = signal(false);
  markdownContent = MOCK_CONTENT;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private configService: ConfigService,
    private layoutService: LayoutService,
    private apiService: ApiService,
    public auth: AuthService
  ) {}

  async ngOnInit() {
    this.layoutService.editorMode.set(true);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/projets']); return; }
    try {
      const proj = await this.projectService.getProject(id);
      this.project.set(proj);
      this.configService.setCurrentProjectId(proj.id);
      try {
        const res = await firstValueFrom(this.apiService.readFile('data/mock-editor.md'));
        this.markdownContent = res.content || MOCK_CONTENT;
      } catch {
        this.markdownContent = proj.content || MOCK_CONTENT;
      }
    } catch {
      this.router.navigate(['/projets']);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.layoutService.editorMode.set(false);
    this.configService.setCurrentProjectId(null);
  }

  onContentChange(content: string) {
    this.markdownContent = content;
    this.isDirty.set(true);
  }

  async save() {
    // TODO: persist
    this.isDirty.set(false);
  }

  get statusLabel(): string {
    return this.project()?.status === 'published' ? 'Publié' : 'Brouillon';
  }
}
