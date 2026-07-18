export interface CutPiece {
  id: string
  label: string
  width: number
  height: number
  quantity: number
  allowRotation: boolean
  color: string
  locked?: boolean
}

export interface PlacedPiece {
  source: CutPiece
  x: number
  y: number
  width: number
  height: number
  isRotated: boolean
}

export interface Sheet {
  index: number
  width: number
  height: number
  placedPieces: PlacedPiece[]
  usedArea: number
  totalArea: number
  efficiency: number
}

export interface UnplacedPiece {
  sourceId: string
  label: string
  width: number
  height: number
}

export interface CuttingResult {
  sheets: Sheet[]
  unplacedPieces: UnplacedPiece[]
  strategy: CuttingStrategy
  autoPickedStrategy?: CuttingStrategy
  totalSheets: number
  totalUsedArea: number
  totalArea: number
  overallEfficiency: number
}

export enum FitHeuristic { BestArea, BestShortSide, BestLongSide }
export enum SortOrder { AreaDesc, MaxSideDesc, PerimeterDesc }
export enum CuttingStrategy {
  Auto,
  BestArea_AreaDesc, BestArea_MaxSideDesc, BestArea_PerimeterDesc,
  BestShortSide_AreaDesc, BestShortSide_MaxSideDesc, BestShortSide_PerimeterDesc,
  BestLongSide_AreaDesc, BestLongSide_MaxSideDesc, BestLongSide_PerimeterDesc,
}

export function newPiece(label: string, w: number, h: number, qty: number, rotation: boolean, color: string): CutPiece {
  return { id: crypto.randomUUID(), label, width: w, height: h, quantity: qty, allowRotation: rotation, color }
}
