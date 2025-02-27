
// Impoertaciones del componente Angular Core
import { Component, ElementRef, ViewChild, AfterViewInit, inject, HostListener, OnDestroy} from '@angular/core';

// Importacion del servicio
import { ThreeService } from '../../services/three.service';




// Componente ancapsulado
@Component({
  selector: 'app-primer-nivel', // Este es para llamar al componente
  imports: [],                  // Importaciones
  templateUrl: './primer-nivel.component.html', // LLama al HTML
  styleUrl: './primer-nivel.component.css'    // LLama al CSS
})



  
// Aqui se exporta el componente y se implementa la logica.
export class PrimerNivelComponent implements AfterViewInit, OnDestroy {

  // Injectamos el servicio
  private threeService = inject(ThreeService);

  @ViewChild('threeCanvas') private canvasRef: ElementRef;
  
  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  
  ngOnInit(): void {
    // Inicialización de componente
  }
  
  ngAfterViewInit(): void {
    // Inicializar el renderer con el canvas y dimensiones actuales
    this.threeService.initRenderer(
      this.canvas,
      this.canvas.parentElement.clientWidth,
      this.canvas.parentElement.clientHeight
    );
    
    // Crear escena básica
    this.threeService.createBasicScene();
    
    // Añadir objetos adicionales
    this.addGameObjects();
  }
  
  addGameObjects(): void {
    // Crear una esfera y posicionarla
    const sphere = this.threeService.createSphere(0.5);
    sphere.position.set(2, 0, 0);
    this.threeService.addObject(sphere);
  }
  
  @HostListener('window:resize')
  onResize(): void {
    if (this.canvas) {
      const width = this.canvas.parentElement.clientWidth;
      const height = this.canvas.parentElement.clientHeight;
      this.threeService.onWindowResize(width, height);
    }
  }
  
  ngOnDestroy(): void {
    // Limpiar recursos si es necesario
  }

}
