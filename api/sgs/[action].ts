import { handleSgsAction } from '../lib/sgsHelper.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action || req.url?.split('?')[0]?.split('/').pop() || '';
  return handleSgsAction(action, req, res);
}
