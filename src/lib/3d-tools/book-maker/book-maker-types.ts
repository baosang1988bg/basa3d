export type BookOrientation = 'V' | 'H';

export interface BookFormatInfo {
  id: string;
  orient: BookOrientation;
  code: string;
  label: string;
  folder: string;
  photo: [number, number]; // [width, height] in mm
  P: number;
  Lov: number;
  Lh: number;
  Dr: number;
  pageDx: number;
  dat: string;
  datKB: number;
}

export type FrontCoverType = 'blank' | 'photo';
export type HingeType = 'snap' | 'filament';

export interface BookMakerConfig {
  formatId: string;
  pages: number;
  frontCoverType: FrontCoverType;
  hingeType: HingeType;
  coverColor: string;
  pageColor: string;
  foldProgress: number; // 0 (flat open) to 1 (closed)
}

export interface BookPartMeshKey {
  back: string;
  front: string;
  spine: string;
  pageNormal: string;
  pageFront: string;
}

export interface BookDesignModifier {
  part: 'back' | 'spine' | 'front';
  hex: string;
  v: string | Float32Array | number[];
  f: string | Uint32Array | number[];
  tris?: number;
}

export interface BookLayoutPart {
  id: string;
  name: string;
  geometry: any; // THREE.BufferGeometry
  colorHex: string;
  extruder: number;
  platerId: number;
  isCoverSubpart?: boolean;
}

export interface BookExportBundle {
  multiPlate3mf: Uint8Array;
  coverFlat3mf: Uint8Array;
  pagesPlate3mf: Uint8Array;
  completeZip: Uint8Array;
}

