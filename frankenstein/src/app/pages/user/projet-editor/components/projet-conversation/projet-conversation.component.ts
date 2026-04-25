import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Message {
  role: 'user' | 'ai';
  content: string;
  items?: string[];
}

@Component({
  selector: 'app-projet-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projet-conversation.component.html',
  host: { class: 'flex flex-col min-h-0 w-80 flex-shrink-0' },
})
export class ProjetConversationComponent {
  inputMessage = '';
  expanded = signal(true);

  messages: Message[] = [
    {
      role: 'ai',
      items: [
        'Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur.',
        'Sit illum facere sed voluptate voluptatibus et autem impedit ab odit sint sit sequi cupiditate et unde tempore est placeat modi.',
        'Est soluta rerum est nostrum similique sit dolores nihil vel sequi quia quo voluptatum repellat sit temporibus laboriosam sit doloremque quos.',
        'In explicabo magni qui rerum nostrum ut quasi minus',
      ],
      content: ''
    },
    {
      role: 'user',
      content: 'Lorem ipsum dolor sit amet. Eos dolor laborum ut dolorum aperiam sit itaque itaque. Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur.'
    },
    {
      role: 'ai',
      content: '',
      items: [
        'Et eveniet ullam et consequatur amet ut nesciunt perferendis ut nulla perspiciatis ut deleniti labore ab autem consequuntur.',
        'Sit illum facere sed voluptate voluptatibus et autem impedit ab odit sint sit sequi cupiditate et unde tempore est placeat modi.',
        'Est soluta rerum est nostrum similique sit dolores nihil vel sequi quia quo voluptatum repellat sit temporibus laboriosam sit doloremque quos.',
        'Rem laboriosam odio qui laudantium reiciendis aut maxime molestias.',
      ]
    }
  ];

  send() {
    if (!this.inputMessage.trim()) return;
    this.messages.push({ role: 'user', content: this.inputMessage });
    this.inputMessage = '';
  }
}
