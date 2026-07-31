import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipeService } from '../../../core/services/recipe.service';

interface StrokeColor {
  label: string;
  value: string;
}

@Component({
  selector: 'app-capture-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capture-modal.component.html',
  styleUrls: ['./capture-modal.component.scss']
})
export class CaptureModalComponent implements AfterViewInit {
  private recipeService = inject(RecipeService);
  private cdr = inject(ChangeDetectorRef);

  @Output() saved = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly colors: StrokeColor[] = [
    { label: 'Rouge', value: '#ef4444' },
    { label: 'Jaune', value: '#facc15' },
    { label: 'Vert', value: '#22c55e' },
    { label: 'Bleu', value: '#3b82f6' },
    { label: 'Noir', value: '#000000' },
    { label: 'Blanc', value: '#ffffff' }
  ];
  readonly widths = [2, 4, 8];

  currentColor = this.colors[0].value;
  currentWidth = this.widths[1];
  hasImage = false;
  isSaving = false;
  errorMessage: string | null = null;

  private baseImage: HTMLImageElement | null = null;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  @HostListener('document:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => this.loadImage(reader.result as string);
        reader.readAsDataURL(file);
        event.preventDefault();
        break;
      }
    }
  }

  private loadImage(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      this.baseImage = img;
      const canvas = this.canvasRef.nativeElement;
      // Limite la taille d'affichage tout en gardant les proportions de la capture d'origine.
      const maxWidth = 860;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      this.ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      this.hasImage = true;
      this.errorMessage = null;
      this.cdr.detectChanges();
    };
    img.src = dataUrl;
  }

  clearAnnotations(): void {
    if (!this.baseImage) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.drawImage(this.baseImage, 0, 0, canvas.width, canvas.height);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.hasImage) return;
    this.drawing = true;
    const pos = this.getPos(event);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing) return;
    const pos = this.getPos(event);
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onPointerUp(): void {
    this.drawing = false;
  }

  private getPos(event: PointerEvent): { x: number, y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  save(): void {
    if (!this.hasImage || this.isSaving) return;
    this.isSaving = true;
    this.errorMessage = null;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.recipeService.uploadCapture(dataUrl).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.saved.emit(res.path);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors de l\'enregistrement de la capture :', err);
        this.isSaving = false;
        this.errorMessage = "Erreur lors de l'enregistrement de la capture sur le serveur.";
        this.cdr.detectChanges();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}
