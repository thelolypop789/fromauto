import { handleSgsAction } from '../lib/sgsHelper.js';

export default async function handler(req: any, res: any) {
  return handleSgsAction('ping', req, res);
}
