import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownEditorComponent } from '../../../../../shared/ui/markdown-editor/markdown-editor.component';

@Component({
  selector: 'app-projet-editor-zone',
  standalone: true,
  imports: [CommonModule, MarkdownEditorComponent],
  templateUrl: './projet-editor-zone.component.html',
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' },
})
export class ProjetEditorZoneComponent implements OnChanges {
  @Input() content = '';
  @Output() contentChange = new EventEmitter<string>();

  localContent = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['content']) {
      this.localContent = changes['content'].currentValue;
    }
  }

  onEditorChange(value: string) {
    this.localContent = value;
    this.contentChange.emit(value);
  }
}
