// tslint:disable-next-line:no-reference
/// <reference path="./keycloak.d.ts" />

import * as express from 'express';
import * as session from 'express-session';
import * as Keycloak from 'keycloak-connect';
import sessionOpts from '../sessionOpts';

export function init(app: express.Express) {

  // Express Session Configuration.
  app.use(session(sessionOpts));

  // Create a session store
  const memoryStore = new session.MemoryStore();
  const keycloak = new Keycloak({ store: memoryStore });

  // Set custom access denied handler
  keycloak.accessDenied = function(req: express.Request, res: express.Response) {
    res.redirect('/access-denied');
  };

  // Use keycloak middleware & define applications logout route
  app.use(keycloak.middleware({logout: '/logout'}));

  // return the keycloak middleware
  return keycloak;
}
