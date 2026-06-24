import { Dimensions } from 'react-native';

const GRID_HORIZONTAL_PAD = 64;
const GRID_GAP = 8;

/** Pixel width for N-column grids inside HealthCheckShell + StepBlock cards. */
export function gridTileWidth(columns: number, horizontalPad = GRID_HORIZONTAL_PAD, gap = GRID_GAP): number {
  const safeCols = Math.max(1, columns);
  const screenW = Dimensions.get('window').width;
  return Math.floor((screenW - horizontalPad - gap * (safeCols - 1)) / safeCols);
}

export { GRID_GAP };
