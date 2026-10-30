import { cloverHandler, cloverSync } from '../_clover.js';
export const config = { maxDuration: 240 };
export default cloverHandler(['POST'], cloverSync);
