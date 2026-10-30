import { cloverDisconnect, cloverHandler, cloverStatus } from '../_clover.js';
export default cloverHandler(['GET', 'DELETE'], (req, res) => req.method === 'DELETE' ? cloverDisconnect(req, res) : cloverStatus(req, res));
