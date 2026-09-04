import * as THREE from 'three';
import * as opentype from 'opentype.js';
import type { Font, PathCommand } from 'opentype.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export type KeychainOptions = {
  text: string;
  baseThicknessMm: number;
  includeKeyringHole: boolean;
  fontSizeMm?: number;
  letterSpacing?: number;
  horizontalPaddingMm?: number;
  verticalPaddingMm?: number;
  cornerRadiusMm?: number;
  textThicknessMm?: number;
  keyringHoleDiameterMm?: number;
};

export type KeychainModel = {
  baseGeometry: THREE.BufferGeometry;
  textGeometry: THREE.BufferGeometry;
  mergedGeometry: THREE.BufferGeometry;
  widthMm: number;
  heightMm: number;
};

let fontPromise: Promise<Font> | null = null;

export function loadKeychainFont(): Promise<Font> {
  fontPromise ??= fetch('/fonts/BeVietnamPro-Regular.ttf')
    .then((response) => {
      if (!response.ok) throw new Error('Không tải được font dựng mẫu.');
      return response.arrayBuffer();
    })
    .then((buffer) => opentype.parse(buffer));
  return fontPromise;
}

function addCommand(shapePath: THREE.ShapePath, command: PathCommand): void {
  switch (command.type) {
    case 'M': shapePath.moveTo(command.x, command.y); break;
    case 'L': shapePath.lineTo(command.x, command.y); break;
    case 'C': shapePath.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y); break;
    case 'Q': shapePath.quadraticCurveTo(command.x1, command.y1, command.x, command.y); break;
    case 'Z': shapePath.currentPath?.closePath(); break;
  }
}

function roundedTagShape(width: number, height: number, options: {
  includeHole: boolean;
  radius: number;
  holeDiameter: number;
  holeCenterX: number;
}): THREE.Shape {
  const radius = Math.min(options.radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(radius, 0);
  shape.lineTo(width - radius, 0);
  shape.quadraticCurveTo(width, 0, width, radius);
  shape.lineTo(width, height - radius);
  shape.quadraticCurveTo(width, height, width - radius, height);
  shape.lineTo(radius, height);
  shape.quadraticCurveTo(0, height, 0, height - radius);
  shape.lineTo(0, radius);
  shape.quadraticCurveTo(0, 0, radius, 0);
  if (options.includeHole) {
    const hole = new THREE.Path();
    hole.absarc(options.holeCenterX, height / 2, options.holeDiameter / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

export function buildKeychainModel(options: KeychainOptions, font: Font): KeychainModel {
  const text = options.text.trim().slice(0, 24) || 'BaSa3D';
  const fontSize = THREE.MathUtils.clamp(options.fontSizeMm ?? 11, 6, 20);
  const letterSpacing = THREE.MathUtils.clamp(options.letterSpacing ?? 1, 0.75, 2);
  const horizontalPadding = THREE.MathUtils.clamp(options.horizontalPaddingMm ?? 7, 4, 16);
  const verticalPadding = THREE.MathUtils.clamp(options.verticalPaddingMm ?? 5, 3, 12);
  const cornerRadius = THREE.MathUtils.clamp(options.cornerRadiusMm ?? 4, 1, 10);
  const textThickness = THREE.MathUtils.clamp(options.textThicknessMm ?? 1.2, 0.6, 3);
  const holeDiameter = THREE.MathUtils.clamp(options.keyringHoleDiameterMm ?? 4.8, 3, 8);
  const ringWall = 2.5;
  const holeCenterX = horizontalPadding + holeDiameter / 2;
  const holeAreaWidth = options.includeKeyringHole ? holeDiameter + ringWall * 2 + horizontalPadding : horizontalPadding;
  const path = font.getPath(text, 0, 0, fontSize, { letterSpacing });
  const bounds = path.getBoundingBox();
  const textWidth = Math.max(1, bounds.x2 - bounds.x1);
  const textHeight = Math.max(1, bounds.y2 - bounds.y1);
  const tagWidth = Math.max(36, textWidth + holeAreaWidth + horizontalPadding);
  const tagHeight = Math.max(18, textHeight + verticalPadding * 2, options.includeKeyringHole ? holeDiameter + ringWall * 2 + 4 : 0);

  const baseGeometry = new THREE.ExtrudeGeometry(roundedTagShape(tagWidth, tagHeight, {
    includeHole: options.includeKeyringHole,
    radius: cornerRadius,
    holeDiameter,
    holeCenterX,
  }), {
    depth: options.baseThicknessMm,
    bevelEnabled: true,
    bevelSize: 0.6,
    bevelThickness: 0.4,
    bevelSegments: 3,
    curveSegments: 12,
  });

  const textPath = new THREE.ShapePath();
  for (const command of path.commands) addCommand(textPath, command);
  const textShapes = textPath.toShapes();
  if (textShapes.length === 0) throw new Error('Nội dung không tạo được hình chữ.');
  const textGeometry = new THREE.ExtrudeGeometry(textShapes, {
    depth: textThickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  const textAreaStart = options.includeKeyringHole ? holeAreaWidth : horizontalPadding;
  textGeometry.translate(textAreaStart + (tagWidth - textAreaStart - horizontalPadding - textWidth) / 2 - bounds.x1, (tagHeight - textHeight) / 2 - bounds.y1, options.baseThicknessMm);

  const mergeInputs = [
    baseGeometry.index ? baseGeometry.toNonIndexed() : baseGeometry.clone(),
    textGeometry.index ? textGeometry.toNonIndexed() : textGeometry.clone(),
  ];
  const mergedGeometry = mergeGeometries(mergeInputs, false);
  mergeInputs.forEach((geometry) => geometry.dispose());
  if (!mergedGeometry) throw new Error('Không thể gộp mô hình STL.');
  mergedGeometry.computeVertexNormals();
  return { baseGeometry, textGeometry, mergedGeometry, widthMm: tagWidth, heightMm: tagHeight };
}

export async function createKeychainModel(options: KeychainOptions): Promise<KeychainModel> {
  return buildKeychainModel(options, await loadKeychainFont());
}

export function exportKeychainStl(geometry: THREE.BufferGeometry): Blob {
  const exporter = new STLExporter();
  const data = exporter.parse(new THREE.Mesh(geometry), { binary: true });
  if (typeof data === 'string') return new Blob([data], { type: 'model/stl' });
  return new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)], { type: 'model/stl' });
}
