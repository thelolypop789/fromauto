import { handleSgsAction } from './lib/sgsHelper.js';

export default async function handler(req: any, res: any) {
  const urlPath = req.url?.split('?')[0] || '';
  const action = req.query?.action || urlPath.split('/').pop() || '';
  return handleSgsAction(action, req, res);
}
