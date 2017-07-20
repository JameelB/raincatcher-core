'use strict';

import * as express from 'express';
const router = express.Router();

router.get('/', (req: express.Request, res: express.Response) => {
  const api = { name: 'raincatcher', version: require('../../package.json').version};
  res.json(api);
});

router.get('/access-denied', (req: express.Request, res: express.Response) => {
  res.json({msg: 'You are not authorized to access this resource'});
});

export default router;
