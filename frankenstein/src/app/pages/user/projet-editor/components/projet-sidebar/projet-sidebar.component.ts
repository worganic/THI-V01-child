import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TreeNode {
  id: string;
  label: string;
  level: number;
  expanded?: boolean;
  active?: boolean;
  highlight?: string;
  children?: TreeNode[];
}

@Component({
  selector: 'app-projet-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-sidebar.component.html',
})
export class ProjetSidebarComponent {
  activeIcon = signal('folder_open');

  tree: TreeNode[] = [
    {
      id: '1', label: 'Nom du projet', level: 0, expanded: true, children: [
        { id: '2', label: 'Setting', level: 1 },
        {
          id: '3', label: 'Section #1', level: 1, expanded: true, children: [
            {
              id: '4', label: 'Section ##2', level: 2, expanded: true, children: [
                { id: '5', label: 'Section ###3', level: 3 },
                { id: '6', label: 'Section ###3', level: 3 },
                {
                  id: '7', label: 'Section ###3', level: 3, expanded: true, children: [
                    {
                      id: '8', label: 'Section ####4', level: 4, expanded: true, children: [
                        {
                          id: '9', label: 'Section #####5', level: 5, expanded: true, children: [
                            { id: '10', label: 'Section ######6', level: 6 }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: '11', label: 'Section #1', level: 1, highlight: 'orange', expanded: true, children: [
            {
              id: '12', label: 'Section ##2', level: 2, highlight: 'yellow', expanded: true, children: [
                { id: '13', label: 'Section ###3', level: 3 },
                { id: '14', label: 'Section ###3', level: 3, highlight: 'blue', active: true },
                { id: '15', label: 'Section ###3', level: 3, highlight: 'green' },
              ]
            }
          ]
        }
      ]
    }
  ];

  selectedId = signal('14');

  setActive(node: TreeNode) {
    this.selectedId.set(node.id);
  }

  toggleExpand(node: TreeNode) {
    node.expanded = !node.expanded;
  }

  highlightClass(node: TreeNode): string {
    switch (node.highlight) {
      case 'orange': return 'text-orange-400 font-bold';
      case 'yellow': return 'text-yellow-300 font-semibold italic';
      case 'blue':   return 'bg-blue-500/20 text-blue-300 font-bold';
      case 'green':  return 'text-green-400 font-bold';
      default: return '';
    }
  }
}
